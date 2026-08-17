import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/**
 * Minimal MCP (Model Context Protocol) stdio client speaking JSON-RPC 2.0.
 *
 * Connects to a stdio MCP server (command + args + env), performs the
 * initialize handshake, and exposes `tools/list` / `tools/call`. The MCP
 * protocol is implemented directly here (rather than depending on the
 * ESM-first `@modelcontextprotocol/sdk`) so the CommonJS NestJS backend can
 * host it without module-resolution friction — the wire contract is identical.
 */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpStdioOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
}

export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpError';
  }
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export class McpStdioClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private requestSerial = 0;
  private readonly pending = new Map<number, Pending>();
  private buffer = '';
  private serverInfo: { name: string; version: string } | undefined;
  private exitCode: number | null | undefined;
  private spawnError: Error | undefined;
  private closed = false;

  constructor(private readonly options: McpStdioOptions) {}

  async connect(): Promise<{ protocolVersion: string; serverInfo: { name: string; version: string } }> {
    this.spawn();
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'deepseek-harness-webgui', version: '0.1.0' },
    });
    if (!isRecord(result)) throw new McpError('MCP initialize returned no result');
    const serverInfo = isRecord(result.serverInfo)
      ? { name: String(result.serverInfo.name ?? ''), version: String(result.serverInfo.version ?? '') }
      : { name: '', version: '' };
    this.serverInfo = serverInfo;
    this.notify('notifications/initialized', {});
    return {
      protocolVersion: typeof result.protocolVersion === 'string' ? result.protocolVersion : '',
      serverInfo,
    };
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.request('tools/list', {});
    if (!isRecord(result) || !Array.isArray(result.tools)) return [];
    return result.tools.filter(isRecord).map((t) => ({
      name: String(t.name ?? ''),
      description: typeof t.description === 'string' ? t.description : undefined,
      inputSchema: t.inputSchema,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{ content: unknown; isError: boolean }> {
    const result = await this.request('tools/call', { name, arguments: args });
    if (!isRecord(result)) return { content: result, isError: false };
    return { content: result.content ?? null, isError: result.isError === true };
  }

  get serverIdentity(): { name: string; version: string } | undefined {
    return this.serverInfo;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const child = this.child;
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null) {
      child.stdin.end();
      const kill = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      }, 500);
      kill.unref();
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    }
  }

  private spawn(): void {
    if (this.child) return;
    const child = spawn(this.options.command, this.options.args ?? [], {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    child.once('error', (error) => {
      this.spawnError = error;
      this.failPending(new McpError(`MCP server failed to start: ${error.message}`));
    });
    child.stdin.on('error', () => {});
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', () => {
      // Server diagnostics are intentionally not surfaced (may contain secrets).
    });
    child.once('exit', (code) => {
      this.exitCode = code;
      this.failPending(new McpError(`MCP server exited with code ${String(code)}`));
    });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let newline: number;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (line.length > 0) this.handleFrame(line);
      }
    });
  }

  private request(method: string, params?: object): Promise<unknown> {
    this.spawn();
    if (this.exitCode !== undefined || this.spawnError !== undefined) {
      return Promise.reject(new McpError('MCP server is not running'));
    }
    const child = this.child;
    if (!child) return Promise.reject(new McpError('MCP server is not running'));

    const id = ++this.requestSerial;
    const frame = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });
    const timeout = this.options.timeoutMs ?? 10_000;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new McpError(`${method} timed out after ${timeout}ms`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${frame}\n`);
    });
  }

  private notify(method: string, params?: object): void {
    const child = this.child;
    if (!child) return;
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {} })}\n`);
  }

  private handleFrame(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (!isRecord(message)) return;

    if (typeof message.id === 'number') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (isRecord(message.error)) {
        pending.reject(new McpError(String(message.error.message ?? 'MCP error')));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  private failPending(error: Error): void {
    for (const [, pending] of this.pending) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
