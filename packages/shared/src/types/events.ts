/**
 * WebSocket protocol envelopes shared between the NestJS gateway and the
 * browser client. A single gateway multiplexes agent, terminal, task and
 * file-change channels using these discriminated message types.
 */

import type { AgentEvent, PermissionDecision } from './agent';

export interface ClientEnvelope {
  channel: 'agent' | 'terminal' | 'task';
  event: ClientEvent;
}

export type ClientEvent =
  | { type: 'subscribe_agent'; sessionId: string }
  | { type: 'unsubscribe_agent'; sessionId: string }
  | { type: 'agent_input'; sessionId: string; message: string }
  | { type: 'approval_response'; requestId: string; decision: PermissionDecision }
  | { type: 'stop_session'; sessionId: string }
  | { type: 'subscribe_terminal'; sessionId: string }
  | { type: 'unsubscribe_terminal'; sessionId: string }
  | { type: 'terminal_input'; sessionId: string; data: string }
  | { type: 'terminal_resize'; sessionId: string; cols: number; rows: number }
  | { type: 'subscribe_project'; projectId: string }
  | { type: 'unsubscribe_project'; projectId: string };

export interface ServerEnvelope {
  channel: 'agent' | 'terminal' | 'task' | 'project';
  event: ServerEvent;
}

export type ServerEvent =
  | { type: 'agent_event'; sessionId: string; event: AgentEvent }
  | { type: 'terminal_output'; sessionId: string; data: string }
  | { type: 'terminal_exit'; sessionId: string; exitCode: number | null }
  | { type: 'task_update'; taskId: string; status: string }
  | { type: 'file_changed'; projectId: string; path: string }
  | { type: 'error'; message: string };
