import type { AgentEvent, AgentStatus } from '@deepseek-harness/shared';

/**
 * Shared transcript model used by the agent panel and the session detail page.
 * Turning the raw event stream into a renderable list lives here so both
 * surfaces stay in sync.
 */

export type TranscriptItem =
  | { kind: 'message'; id: string; role: string; content: string }
  | { kind: 'tool'; id: string; tool: string; input: unknown; output?: unknown; isError?: boolean }
  | { kind: 'command'; id: string; command: string }
  | { kind: 'file'; id: string; path: string; change: string }
  | { kind: 'task'; id: string; title: string; status: string }
  | { kind: 'subagent'; id: string; text: string }
  | { kind: 'error'; id: string; message: string };

export interface PlanDisplayItem {
  id: string;
  title: string;
  status: string;
}

export interface TaskDisplayItem {
  id: string;
  title: string;
  status: string;
}

export function statusFromEvents(events: AgentEvent[]): AgentStatus {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'status') return e.status;
  }
  return 'idle';
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildTranscript(events: AgentEvent[]): { items: TranscriptItem[]; streaming: string } {
  const items: TranscriptItem[] = [];
  const toolIndex = new Map<string, number>();
  let streaming = '';

  for (const e of events) {
    switch (e.type) {
      case 'message':
        if (e.role === 'assistant') streaming = '';
        items.push({ kind: 'message', id: e.id, role: e.role, content: e.content });
        break;
      case 'message_delta':
        streaming += e.content;
        break;
      case 'tool_call': {
        toolIndex.set(e.id, items.length);
        items.push({ kind: 'tool', id: e.id, tool: e.tool, input: e.input });
        break;
      }
      case 'tool_result': {
        const idx = toolIndex.get(e.toolCallId);
        if (idx !== undefined) {
          const item = items[idx] as Extract<TranscriptItem, { kind: 'tool' }>;
          item.output = e.output;
          item.isError = e.isError;
        }
        break;
      }
      case 'command':
        items.push({ kind: 'command', id: e.command, command: e.command });
        break;
      case 'file_changed':
        items.push({ kind: 'file', id: `${e.path}:${e.change}`, path: e.path, change: e.change });
        break;
      case 'task_update':
        items.push({ kind: 'task', id: e.task.id, title: e.task.title, status: e.task.status });
        break;
      case 'subagent':
        items.push({
          kind: 'subagent',
          id: `${e.childSessionId}:${e.action}`,
          text:
            e.action === 'started'
              ? `Subagent spawned (${e.childSessionId.slice(0, 8)}…)`
              : `Subagent finished (${e.childSessionId.slice(0, 8)}…)${e.status ? ` · ${e.status}` : ''}`,
        });
        break;
      case 'error':
        items.push({ kind: 'error', id: e.message, message: e.message });
        break;
    }
  }

  return { items, streaming };
}

/** Latest plan snapshot (a `plan` event carries the full plan each time). */
export function extractPlan(events: AgentEvent[]): PlanDisplayItem[] {
  let plan: PlanDisplayItem[] = [];
  for (const e of events) {
    if (e.type === 'plan') {
      plan = e.items.map((item) => ({ id: item.id, title: item.title, status: item.status }));
    }
  }
  return plan;
}

/** Task updates, deduped by id with the latest status winning. */
export function extractTasks(events: AgentEvent[]): TaskDisplayItem[] {
  const map = new Map<string, TaskDisplayItem>();
  for (const e of events) {
    if (e.type === 'task_update') {
      map.set(e.task.id, { id: e.task.id, title: e.task.title, status: e.task.status });
    }
  }
  return [...map.values()];
}
