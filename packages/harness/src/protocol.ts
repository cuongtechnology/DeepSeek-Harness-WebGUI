import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/**
 * Client for the official DeepSeek Harness SDK wire protocol.
 *
 * This speaks the exact `@deepseek-ai/dsh-sdk-protocol` JSON-RPC contract over
 * newline-delimited stdio: three requests (`initialize`, `session/prompt`,
 * `shutdown`) and four server notifications (`session.event`, `session.status`,
 * `subagent.started`, `subagent.finished`). It drives the `dsh-jsonrpc-agent`
 * runtime binary — the same unattended JSON-RPC composition the official
 * TypeScript and Python SDKs spawn.
 *
 * The protocol is deliberately implemented here (rather than depending on the
 * ESM-only, pre-release `@deepseek-ai/dsh-sdk-client`) so the NestJS CommonJS
 * backend can host it; the wire shapes below mirror the upstream types 1:1.
 */

export interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

export function textBlock(text: string): ContentBlock {
  return { type: 'text', text };
}

export interface HarnessNotification {
  method: string;
  params: Record<string, unknown>;
}

export interface InitializeParams {
  cwd: string;
  provider: string;
  model: string;
  maxTokens?: number;
}

export interface InitializeResult {
  serverInfo: { name: string; version: string };
}

export interface SdkRuntimeOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  requestTimeoutMs?: number;
  disposeGraceMs?: number;
}

export class TransportClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportClosedError';
  }
}

export class RequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout | null;
}

interface Subscription {
  filter?: (n: HarnessNotification) => boolean;
  queue: HarnessNotification[];
  waiters: Array<{
    resolve: (n: HarnessNotification) => void;
    reject: (e: Error) => void;
  }>;
  failure?: Error;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Owns one `dsh-jsonrpc-agent` subprocess and multiplexes JSON-RPC requests
 * and notification subscriptions over its stdio.
 */
export class SdkRuntimeClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private requestSerial = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly subscriptions = new Map<number, Subscription>();
  private subscriptionSerial = 0;
  private stdinBuffer = '';
  private exitCode: number | null | undefined;
  private spawnError: Error | undefined;
  private closed = false;
  private readonly stderrTail: string[] = [];

  constructor(private readonly options: SdkRuntimeOptions) {}

  start(): void {
    if (this.closed) throw new TransportClosedError('DeepSeek Harness runtime client is closed');
    if (this.child) return;

    const child = spawn(this.options.command, this.options.args ?? [], {
      cwd: this.options.cwd,
      env: this.options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    child.once('error', (error) => {
      this.spawnError = error;
      this.failPending(this.closedError('DeepSeek Harness runtime failed to start'));
      this.failSubscriptions(this.closedError('DeepSeek Harness runtime failed to start'));
    });

    child.stdin.on('error', () => {
      // Writes racing the runtime's death raise EPIPE; the exit edge is authoritative.
    });

    let stderrBuffer = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderrBuffer += chunk;
      const newline = stderrBuffer.lastIndexOf('\n');
      if (newline >= 0) {
        this.appendStderr(stderrBuffer.slice(0, newline).split('\n'));
        stderrBuffer = stderrBuffer.slice(newline + 1);
      }
    });

    child.once('exit', (code) => {
      this.exitCode = code;
      this.failPending(this.closedError('DeepSeek Harness runtime exited'));
      this.failSubscriptions(this.closedError('DeepSeek Harness runtime exited'));
    });

    let stdoutBuffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      let newline: number;
      while ((newline = stdoutBuffer.indexOf('\n')) >= 0) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line.length > 0) this.handleFrame(line);
      }
    });
  }

  async initialize(params: InitializeParams): Promise<InitializeResult> {
    const result = await this.request('initialize', { ...params });
    if (!isRecord(result) || !isRecord(result.serverInfo)) {
      throw new ProtocolError(`initialize returned no server identity: ${JSON.stringify(result)}`);
    }
    return {
      serverInfo: {
        name: String(result.serverInfo.name),
        version: String(result.serverInfo.version),
      },
    };
  }

  /** Queue one prompt and return its durable inbox message id. */
  async prompt(sessionId: string, contentBlocks: ContentBlock[]): Promise<string> {
    const result = await this.request('session/prompt', { sessionId, contentBlocks });
    if (!isRecord(result) || typeof result.messageId !== 'string') {
      throw new ProtocolError(`session/prompt returned no message id: ${JSON.stringify(result)}`);
    }
    return result.messageId;
  }

  async request(method: string, params?: object): Promise<unknown> {
    this.start();
    if (this.exitCode !== undefined || this.spawnError !== undefined) {
      throw this.closedError('DeepSeek Harness runtime is not running');
    }
    const child = this.child;
    if (!child) throw new TransportClosedError('DeepSeek Harness runtime is not running');

    const id = ++this.requestSerial;
    const frame = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });
    const timeout = this.options.requestTimeoutMs;

    return new Promise<unknown>((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            this.pending.delete(id);
            reject(new RequestTimeoutError(`${method} timed out after ${timeout}ms`));
          }, timeout)
        : null;
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${frame}\n`);
    });
  }

  subscribe(filter?: (n: HarnessNotification) => boolean): AsyncIterable<HarnessNotification> & {
    close(): void;
  } {
    const id = ++this.subscriptionSerial;
    const state: Subscription = { filter, queue: [], waiters: [], failure: undefined };
    this.subscriptions.set(id, state);

    const next = (): Promise<HarnessNotification> => {
      const queued = state.queue.shift();
      if (queued !== undefined) return Promise.resolve(queued);
      if (state.failure) return Promise.reject(state.failure);
      return new Promise<HarnessNotification>((resolve, reject) => {
        state.waiters.push({ resolve, reject });
      });
    };

    const iterator: AsyncIterable<HarnessNotification> & { close(): void } = {
      close: () => {
        this.subscriptions.delete(id);
        state.queue.length = 0;
        state.failure ??= new TransportClosedError('subscription closed');
        for (const w of state.waiters.splice(0)) w.reject(state.failure);
      },
      [Symbol.asyncIterator](): AsyncIterator<HarnessNotification> {
        return {
          next: async () => ({ value: await next(), done: false }),
        };
      },
    };
    return iterator;
  }

  /** Subscribe to notifications for one session and its discovered descendants. */
  subscribeSessionTree(sessionId: string): AsyncIterable<HarnessNotification> & { close(): void } {
    const parents = new Map<string, string>();
    return this.subscribe((n) => {
      const params = n.params;
      if (n.method === 'subagent.started') {
        const parent = params.parentSessionId;
        const child = params.childSessionId;
        if (typeof parent === 'string' && typeof child === 'string') parents.set(child, parent);
      }
      const related =
        typeof params.sessionId === 'string' ? params.sessionId : params.childSessionId;
      return typeof related === 'string' && this.isDescendant(related, sessionId, parents);
    });
  }

  /** Best-effort `shutdown`, then stdin-EOF -> SIGTERM -> SIGKILL reaping ladder. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const child = this.child;
    if (!child) return;
    try {
      await this.request('shutdown', {});
    } catch {
      // Diagnostic only; the dispose ladder below is authoritative.
    }
    const grace = this.options.disposeGraceMs ?? 3_000;
    if (child.exitCode !== null || child.signalCode !== null) {
      // Already exited; nothing to reap.
      return;
    }
    child.stdin.end();
    const term = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    }, grace);
    const kill = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, grace * 2);
    term.unref();
    kill.unref();
    await new Promise<void>((resolve) => {
      child.once('exit', () => {
        clearTimeout(term);
        clearTimeout(kill);
        resolve();
      });
    });
  }

  get running(): boolean {
    return this.child !== undefined && this.exitCode === undefined && this.spawnError === undefined && !this.closed;
  }

  private handleFrame(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.appendStderr([`non-JSON frame: ${line.slice(0, 200)}`]);
      return;
    }
    if (!isRecord(message)) return;

    if (typeof message.id === 'number') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (isRecord(message.error)) {
        pending.reject(
          new ProtocolError(
            `${message.error.message ?? 'JSON-RPC error'} (code ${String(message.error.code)})`,
          ),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    // Notification (no id).
    if (typeof message.method === 'string') {
      const notification: HarnessNotification = {
        method: message.method,
        params: isRecord(message.params) ? message.params : {},
      };
      for (const sub of this.subscriptions.values()) {
        let matches = true;
        try {
          matches = sub.filter === undefined || sub.filter(notification);
        } catch {
          matches = false;
        }
        if (!matches) continue;
        const waiter = sub.waiters.shift();
        if (waiter) waiter.resolve(notification);
        else sub.queue.push(notification);
      }
    }
  }

  private isDescendant(sessionId: string, root: string, parents: Map<string, string>): boolean {
    if (sessionId === root) return true;
    let current = sessionId;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      if (current === root) return true;
      seen.add(current);
      const parent = parents.get(current);
      if (parent === undefined) return false;
      current = parent;
    }
    return false;
  }

  private failPending(error: Error): void {
    for (const [, pending] of this.pending) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private failSubscriptions(error: Error): void {
    for (const sub of this.subscriptions.values()) {
      sub.failure ??= error;
      for (const w of sub.waiters.splice(0)) w.reject(error);
    }
  }

  private appendStderr(lines: string[]): void {
    this.stderrTail.push(...lines.filter((l) => l.length > 0));
    if (this.stderrTail.length > 400) this.stderrTail.splice(0, this.stderrTail.length - 400);
  }

  private closedError(reason: string): TransportClosedError {
    const parts = [reason];
    if (this.spawnError) parts.push(`spawn error: ${this.spawnError.message}`);
    if (this.exitCode !== undefined) parts.push(`exit code: ${String(this.exitCode)}`);
    if (this.stderrTail.length > 0) parts.push(`stderr tail:\n${this.stderrTail.join('\n')}`);
    return new TransportClosedError(parts.join('\n'));
  }
}
