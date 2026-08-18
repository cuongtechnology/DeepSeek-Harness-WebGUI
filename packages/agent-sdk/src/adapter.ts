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
  /** Whether the runtime can be installed on-demand (opt-in, with user consent). */
  installable?: boolean;
  /** Supported install methods, e.g. ['pip', 'source']. */
  installMethods?: string[];
}

/** Options for an on-demand runtime install. */
export interface InstallOptions {
  /** Install method, e.g. 'pip' or 'source'. */
  method?: string;
}

/** Result of an on-demand runtime install attempt. */
export interface InstallResult {
  success: boolean;
  /** Resolved runtime executable path after a successful install. */
  command?: string;
  /** Resolved default runtime config path (e.g. DSH_CORDIS_CONFIG), when applicable. */
  configPath?: string;
  /** Human-readable error when failed. */
  error?: string;
  /** Captured command output tail (secrets redacted by the implementation). */
  output?: string;
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
   * Whether human approval decisions (allow/deny) made in the UI can be
   * delivered back to the runtime. Defaults to false. Adapters that only
   * observe `approval_request` events but have no reverse channel (e.g. a
   * wire protocol without an approval-response request) must leave this
   * unset so the UI does not offer buttons that cannot take effect.
   */
  readonly supportsApprovalResponses?: boolean;

  /**
   * Detect whether the runtime backing this adapter is installed and usable,
   * without starting a session.
   */
  detect(): Promise<RuntimeInfo>;

  /**
   * Install the runtime backing this adapter, if it supports on-demand
   * installation. Implementations MUST be opt-in: the caller is responsible for
   * obtaining user consent before invoking this (see `RuntimeInfo.installable`).
   */
  install?(options?: InstallOptions): Promise<InstallResult>;

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
