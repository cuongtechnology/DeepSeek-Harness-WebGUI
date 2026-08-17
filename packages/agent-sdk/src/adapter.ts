import type { AgentEvent, AgentStatus } from '@deepseek-harness/shared';

/**
 * Options passed to an adapter when starting a session.
 */
export interface AgentSessionOptions {
  sessionId: string;
  projectId: string;
  workspacePath: string;
  model?: string;
  /** Additional environment variables for the agent process. */
  env?: Record<string, string>;
  /**
   * Optional sink for events as they occur. Used by the API to fan events out
   * to WebSocket subscribers and persistence. Adapters must call this for
   * every event they emit.
   */
  onEvent?: (event: AgentEvent) => void | Promise<void>;
}

export interface AgentSession {
  id: string;
  adapterId: string;
  status: AgentStatus;
}

/** Result of detecting an agent runtime's availability on the host. */
export interface RuntimeInfo {
  id: string;
  name: string;
  available: boolean;
  version: string | null;
  /** Resolved executable path when available. */
  command?: string;
  /** Human-readable reason when unavailable. */
  reason?: string;
}

/**
 * The runtime-agnostic agent contract. Every agent runtime (DeepSeek Harness,
 * Claude Code, Codex, OpenHands, custom) is represented by an adapter that
 * implements this interface. No part of the application outside of the adapter
 * package may assume a specific runtime.
 */
export interface AgentAdapter {
  /** Stable unique id, e.g. "deepseek-harness". */
  readonly id: string;
  /** Human-friendly display name, e.g. "DeepSeek Harness". */
  readonly name: string;
  /** Optional description shown in the UI. */
  readonly description?: string;
  /** Optional list of capability hints shown in the UI. */
  readonly capabilities?: string[];

  /**
   * Detect whether the runtime backing this adapter is installed and usable,
   * without starting a session.
   */
  detect(): Promise<RuntimeInfo>;

  startSession(options: AgentSessionOptions): Promise<AgentSession>;

  sendMessage(sessionId: string, message: string): Promise<void>;

  stopSession(sessionId: string): Promise<void>;

  getStatus(sessionId: string): Promise<AgentStatus>;

  /**
   * Stream normalized events for a session. Implementations should complete
   * the iterable once the session has ended.
   */
  streamEvents(sessionId: string): AsyncIterable<AgentEvent>;

  /** Free all resources for a session (called after it ends). */
  disposeSession?(sessionId: string): Promise<void>;

  /** Dispose every session and release the runtime (called on shutdown). */
  disposeAll?(): Promise<void>;
}
