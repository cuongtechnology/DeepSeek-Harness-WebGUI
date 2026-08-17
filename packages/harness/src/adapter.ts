import type {
  AgentAdapter,
  AgentSession,
  AgentSessionOptions,
  RuntimeInfo,
} from '@deepseek-harness/agent-sdk';
import type { AgentEvent, AgentStatus } from '@deepseek-harness/shared';
import { createId } from '@deepseek-harness/shared';
import { loadHarnessConfig, type HarnessConfig } from './config';
import { isCommandAvailable } from './availability';
import {
  SdkRuntimeClient,
  textBlock,
  type HarnessNotification,
  type InitializeResult,
} from './protocol';
import { normalizeNotification } from './normalize';
import { AsyncQueue } from './async-queue';

interface RuntimeHandle {
  workspacePath: string;
  client: SdkRuntimeClient;
  initialized: Promise<InitializeResult>;
  sessions: Set<string>;
}

interface SessionRuntime {
  options: AgentSessionOptions;
  runtime: RuntimeHandle;
  subscription: AsyncIterable<HarnessNotification> & { close(): void };
  queue: AsyncQueue<AgentEvent>;
  status: AgentStatus;
  ended: boolean;
  stopping: boolean;
}

const now = (): string => new Date().toISOString();

/**
 * DeepSeek Harness adapter.
 *
 * Drives the official `dsh-jsonrpc-agent` SDK runtime over stdio JSON-RPC (the
 * same interface the official TypeScript and Python SDKs use). One runtime
 * subprocess is kept per workspace and shared by the sessions in it, matching
 * the upstream SDK's "one runtime, many sessions" model. Session events
 * (`session.event`), whole-agent status (`session.status`), and subagent
 * lifecycle notifications are normalized into the WebGUI event model.
 */
export class DeepSeekHarnessAdapter implements AgentAdapter {
  readonly id = 'deepseek-harness';
  readonly name = 'DeepSeek Harness';
  readonly description =
    'Runs the official DeepSeek Harness (dsh) coding agent via its JSON-RPC SDK runtime. ' +
    'The runtime executable is configured with DEEPSEEK_HARNESS_COMMAND.';
  readonly capabilities = ['shell', 'filesystem', 'git', 'network', 'subagents'];

  private readonly config: HarnessConfig;
  private readonly runtimes = new Map<string, RuntimeHandle>();
  private readonly sessions = new Map<string, SessionRuntime>();

  constructor(config?: Partial<HarnessConfig>) {
    this.config = { ...loadHarnessConfig(), ...config };
  }

  async detect(): Promise<RuntimeInfo> {
    const availability = isCommandAvailable(this.config.command);
    if (!availability.available) {
      return {
        id: this.id,
        name: this.name,
        available: false,
        version: null,
        reason: availability.reason,
      };
    }
    return {
      id: this.id,
      name: this.name,
      available: true,
      version: null,
      command: availability.path,
    };
  }

  async startSession(options: AgentSessionOptions): Promise<AgentSession> {
    if (this.sessions.has(options.sessionId)) {
      throw new Error(`Agent session already running: ${options.sessionId}`);
    }

    const runtime = await this.getOrCreateRuntime(options.workspacePath);
    const subscription = runtime.client.subscribeSessionTree(options.sessionId);

    const sr: SessionRuntime = {
      options,
      runtime,
      subscription,
      queue: new AsyncQueue<AgentEvent>(),
      status: 'idle',
      ended: false,
      stopping: false,
    };
    this.sessions.set(options.sessionId, sr);
    runtime.sessions.add(options.sessionId);

    this.emit(sr, {
      type: 'session_started',
      sessionId: options.sessionId,
      adapterId: this.id,
      timestamp: now(),
    });
    this.emit(sr, { type: 'status', status: 'idle', timestamp: now() });

    void this.consume(sr);
    return { id: options.sessionId, adapterId: this.id, status: sr.status };
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const sr = this.requireSession(sessionId);
    if (sr.ended) {
      throw new Error(`Agent session has ended: ${sessionId}`);
    }
    this.emit(sr, { type: 'message', id: createId('msg'), role: 'user', content: message, timestamp: now() });
    await sr.runtime.client.prompt(sessionId, [textBlock(message)]);
  }

  async stopSession(sessionId: string): Promise<void> {
    const sr = this.requireSession(sessionId);
    if (sr.ended) return;
    sr.stopping = true;
    this.setStatus(sr, 'stopped');

    // The SDK wire protocol has no per-turn cancel; stopping a session stops
    // the workspace runtime it lives in (which also stops sibling sessions in
    // that workspace). This limitation is documented in docs/agents.md.
    const runtime = sr.runtime;
    for (const id of [...runtime.sessions]) {
      const sibling = this.sessions.get(id);
      if (sibling && !sibling.ended) {
        sibling.stopping = true;
        this.finalizeSession(sibling, 'stopped', null);
      }
    }
    await this.closeRuntime(runtime);
  }

  async getStatus(sessionId: string): Promise<AgentStatus> {
    return this.requireSession(sessionId).status;
  }

  async *streamEvents(sessionId: string): AsyncIterable<AgentEvent> {
    const sr = this.requireSession(sessionId);
    yield* sr.queue;
  }

  async disposeSession(sessionId: string): Promise<void> {
    const sr = this.sessions.get(sessionId);
    if (!sr) return;
    sr.subscription.close();
    sr.queue.close();
    this.sessions.delete(sessionId);
    sr.runtime.sessions.delete(sessionId);
    if (sr.runtime.sessions.size === 0) {
      await this.closeRuntime(sr.runtime);
    }
  }

  async disposeAll(): Promise<void> {
    for (const id of [...this.sessions.keys()]) {
      await this.disposeSession(id);
    }
  }

  private async getOrCreateRuntime(workspacePath: string): Promise<RuntimeHandle> {
    const existing = this.runtimes.get(workspacePath);
    if (existing) {
      await existing.initialized;
      return existing;
    }

    const client = new SdkRuntimeClient({
      command: this.config.command,
      args: this.config.args,
      env: this.runtimeEnv(workspacePath),
      requestTimeoutMs: this.config.requestTimeoutMs,
      disposeGraceMs: this.config.disposeGraceMs,
    });

    const handle: RuntimeHandle = {
      workspacePath,
      client,
      initialized: client.initialize({
        cwd: workspacePath,
        provider: this.config.provider,
        model: this.config.model,
        ...(this.config.maxTokens === undefined ? {} : { maxTokens: this.config.maxTokens }),
      }),
      sessions: new Set<string>(),
    };

    this.runtimes.set(workspacePath, handle);
    try {
      await handle.initialized;
    } catch (error) {
      this.runtimes.delete(workspacePath);
      await client.close();
      throw new Error(
        `Failed to initialize DeepSeek Harness runtime: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return handle;
  }

  /** Environment for the runtime: inherits the host env plus per-workspace DSH_* overrides. */
  private runtimeEnv(workspacePath: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      DSH_CWD: workspacePath,
      DSH_MODEL: this.config.model,
    };
  }

  private async consume(sr: SessionRuntime): Promise<void> {
    try {
      for await (const notification of sr.subscription) {
        if (sr.ended) break;
        const events = normalizeNotification(notification, sr.options.sessionId);
        for (const event of events) {
          if (event.type === 'status') sr.status = event.status;
          this.emit(sr, event);
        }
      }
      if (!sr.ended) {
        this.finalizeSession(sr, 'completed', null);
      }
    } catch (error) {
      if (!sr.ended) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit(sr, { type: 'error', message, timestamp: now() });
        this.finalizeSession(sr, sr.stopping ? 'stopped' : 'failed', null);
      }
    }
  }

  private finalizeSession(sr: SessionRuntime, status: AgentStatus, exitCode: number | null): void {
    if (sr.ended) return;
    sr.ended = true;
    this.setStatus(sr, status);
    this.emit(sr, {
      type: 'session_ended',
      sessionId: sr.options.sessionId,
      exitCode,
      timestamp: now(),
    });
    sr.subscription.close();
    sr.queue.close();
    sr.runtime.sessions.delete(sr.options.sessionId);
    // The session stays registered so getStatus() reports its final status
    // until disposeSession() releases it.
  }

  private setStatus(sr: SessionRuntime, status: AgentStatus): void {
    if (sr.status === status) return;
    sr.status = status;
    this.emit(sr, { type: 'status', status, timestamp: now() });
  }

  private emit(sr: SessionRuntime, event: AgentEvent): void {
    sr.queue.push(event);
    const onEvent = sr.options.onEvent;
    if (onEvent) {
      void Promise.resolve(onEvent(event)).catch(() => {
        // A failing observer must not break the session stream.
      });
    }
  }

  private async closeRuntime(runtime: RuntimeHandle): Promise<void> {
    if (this.runtimes.get(runtime.workspacePath) !== runtime) return;
    this.runtimes.delete(runtime.workspacePath);
    await runtime.client.close();
  }

  private requireSession(sessionId: string): SessionRuntime {
    const sr = this.sessions.get(sessionId);
    if (!sr) throw new Error(`Agent session not found: ${sessionId}`);
    return sr;
  }
}
