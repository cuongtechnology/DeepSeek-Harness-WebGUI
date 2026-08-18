/**
 * Normalized agent event model shared between the backend, agent adapters and
 * the frontend. Every adapter is responsible for translating its native
 * runtime output into these events.
 */

export type AgentStatus =
  | 'idle'
  | 'starting'
  | 'thinking'
  | 'running'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'
  | 'stopped';

export type AgentEventType =
  | 'session_started'
  | 'message'
  | 'message_delta'
  | 'tool_call'
  | 'tool_result'
  | 'file_changed'
  | 'command'
  | 'status'
  | 'approval_request'
  | 'approval_result'
  | 'plan'
  | 'task_update'
  | 'subagent'
  | 'plan_mode'
  | 'turn'
  | 'step'
  | 'request_header'
  | 'compaction'
  | 'session_title'
  | 'error'
  | 'session_ended';

export interface PlanItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface TaskUpdate {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export type PermissionCategory = 'shell' | 'filesystem' | 'network' | 'git' | 'package_install';

export type PermissionPolicy = 'always_allow' | 'ask' | 'deny';

export type PermissionDecision = 'allow_once' | 'allow_always' | 'deny';

export interface FileChangeEvent {
  path: string;
  change: 'create' | 'update' | 'delete';
}

interface BaseEvent {
  timestamp: string;
}

export interface SessionStartedEvent extends BaseEvent {
  type: 'session_started';
  sessionId: string;
  adapterId: string;
}

export interface MessageEvent extends BaseEvent {
  type: 'message';
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  /** Token usage reported by the runtime for an assistant message. */
  usage?: TokenUsage;
}

/** Token counts as reported on `assistant/message` (`usage` in the wire event). */
export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export interface MessageDeltaEvent extends BaseEvent {
  type: 'message_delta';
  messageId: string;
  content: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  id: string;
  tool: string;
  input: unknown;
}

export interface ToolResultEvent extends BaseEvent {
  type: 'tool_result';
  toolCallId: string;
  tool: string;
  output: unknown;
  isError?: boolean;
}

export interface FileChangedEvent extends BaseEvent {
  type: 'file_changed';
  path: string;
  change: 'create' | 'update' | 'delete';
}

export interface CommandEvent extends BaseEvent {
  type: 'command';
  command: string;
  cwd?: string;
}

export interface StatusEvent extends BaseEvent {
  type: 'status';
  status: AgentStatus;
}

export interface ApprovalRequestEvent extends BaseEvent {
  type: 'approval_request';
  id: string;
  category: PermissionCategory;
  action: string;
  details?: unknown;
}

export interface ApprovalResultEvent extends BaseEvent {
  type: 'approval_result';
  requestId: string;
  decision: PermissionDecision;
}

export interface PlanEvent extends BaseEvent {
  type: 'plan';
  items: PlanItem[];
}

export interface TaskUpdateEvent extends BaseEvent {
  type: 'task_update';
  task: TaskUpdate;
}

export interface SubagentEvent extends BaseEvent {
  type: 'subagent';
  action: 'started' | 'finished';
  childSessionId: string;
  parentSessionId: string;
  provider?: string;
  status?: 'ok' | 'error';
}

/** Plan-mode state as logged by the runtime (`plan/mode` wire event). */
export interface PlanModeEvent extends BaseEvent {
  type: 'plan_mode';
  active: boolean;
  details?: unknown;
}

/** Turn boundary (`turn/start` / `turn/end` wire events). */
export interface TurnEvent extends BaseEvent {
  type: 'turn';
  phase: 'start' | 'end';
  index: number;
  /** `kind` from the wire `TurnEndReason` (completed/aborted/blocked/error/max-tokens/interrupted). */
  reason?: string;
}

/** Step boundary (`step/start` / `step/end` wire events). */
export interface StepEvent extends BaseEvent {
  type: 'step';
  phase: 'start' | 'end';
  turn: number;
  index: number;
}

/** Model request metadata (`request/header` wire event). */
export interface RequestHeaderEvent extends BaseEvent {
  type: 'request_header';
  model?: string;
  reason?: string;
  details?: unknown;
}

/** Context compaction lifecycle (`compaction/*` wire events). */
export interface CompactionEvent extends BaseEvent {
  type: 'compaction';
  phase: 'start' | 'end' | 'summary' | 'prune';
  summary?: string;
  shadowedTokenCount?: number;
  details?: unknown;
}

/** Auto-generated session title (`session/title` wire event). */
export interface SessionTitleEvent extends BaseEvent {
  type: 'session_title';
  title: string;
  source?: string;
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  message: string;
}

export interface SessionEndedEvent extends BaseEvent {
  type: 'session_ended';
  sessionId: string;
  exitCode: number | null;
}

export type AgentEvent =
  | SessionStartedEvent
  | MessageEvent
  | MessageDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | FileChangedEvent
  | CommandEvent
  | StatusEvent
  | ApprovalRequestEvent
  | ApprovalResultEvent
  | PlanEvent
  | TaskUpdateEvent
  | SubagentEvent
  | PlanModeEvent
  | TurnEvent
  | StepEvent
  | RequestHeaderEvent
  | CompactionEvent
  | SessionTitleEvent
  | ErrorEvent
  | SessionEndedEvent;

/**
 * A pending approval that must be resolved by a human before the agent may
 * continue. Produced by the approval gate and consumed by adapters.
 */
export interface ApprovalRequest {
  id: string;
  category: PermissionCategory;
  action: string;
  details?: unknown;
  sessionId: string;
  createdAt: string;
  resolve: (decision: PermissionDecision) => void;
}

export interface PermissionPolicyMap {
  shell: PermissionPolicy;
  filesystem: PermissionPolicy;
  network: PermissionPolicy;
  git: PermissionPolicy;
  package_install: PermissionPolicy;
}

export const DEFAULT_PERMISSION_POLICIES: PermissionPolicyMap = {
  shell: 'ask',
  filesystem: 'ask',
  network: 'ask',
  git: 'always_allow',
  package_install: 'ask',
};
