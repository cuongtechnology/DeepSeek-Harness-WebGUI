import type { AgentEvent } from '@deepseek-harness/shared';
import { createShortId } from '@deepseek-harness/shared';
import type { HarnessNotification } from './protocol';

/**
 * Maps the official DeepSeek Harness SDK notification stream into the WebGUI's
 * normalized {@link AgentEvent} model. The shapes below mirror
 * `@deepseek-ai/dsh-session`'s `SessionEvent` discriminated union and the four
 * `@deepseek-ai/dsh-sdk-protocol` notification payloads.
 */

export interface WireSessionEvent {
  type: string;
  seq?: number;
  time?: number;
  data?: Record<string, unknown>;
  ignorable?: boolean;
  [key: string]: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const now = (): string => new Date().toISOString();

/** Concatenate the text of OpenAI-style content blocks. */
function contentBlocksToText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => isRecord(b) && b.type === 'text' && typeof b.text === 'string')
    .map((b) => (b as { text: string }).text)
    .join('');
}

/** Best-effort text extraction from an `assistant/chunk` StreamChunk payload. */
function chunkToText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (isRecord(chunk)) {
    if (typeof chunk.text === 'string') return chunk.text;
    if (typeof chunk.delta === 'string') return chunk.delta;
  }
  return '';
}

/** Parse a tool-call argument string (raw JSON as produced by the model). */
function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function stepMessageId(event: WireSessionEvent, fallback: string): string {
  const turn = event.data?.turn;
  const step = event.data?.step;
  if (typeof turn === 'number' && typeof step === 'number') return `step-${turn}-${step}`;
  return fallback;
}

/**
 * Normalize one `session.event` payload into zero or more AgentEvents.
 * Unknown/structural event types are dropped (not fabricated).
 */
export function normalizeSessionEvent(event: unknown, _sessionId: string): AgentEvent[] {
  if (!isRecord(event) || typeof event.type !== 'string') return [];
  const ev = event as WireSessionEvent;
  const data = isRecord(ev.data) ? ev.data : {};

  switch (ev.type) {
    case 'assistant/chunk': {
      const text = chunkToText(data.chunk);
      if (text.length === 0) return [];
      return [
        {
          type: 'message_delta',
          messageId: stepMessageId(ev, createShortId('msg')),
          content: text,
          timestamp: now(),
        },
      ];
    }

    case 'assistant/message': {
      const message = isRecord(data.message) ? data.message : {};
      const text = contentBlocksToText(message.content);
      const id = typeof message.id === 'string' && message.id ? message.id : stepMessageId(ev, createShortId('msg'));
      const event: Extract<AgentEvent, { type: 'message' }> = {
        type: 'message',
        id,
        role: 'assistant',
        content: text,
        timestamp: now(),
      };
      // The wire event carries optional `usage` (TokenUsage) on the data payload.
      if (isRecord(data.usage)) {
        const usage: { input?: number; output?: number; total?: number } = {};
        for (const key of ['input', 'output', 'total'] as const) {
          if (typeof data.usage[key] === 'number') usage[key] = data.usage[key];
        }
        if (Object.keys(usage).length > 0) event.usage = usage;
      }
      return [event];
    }

    case 'user/message': {
      const text = contentBlocksToText(data.content);
      const source = typeof data.source === 'string' ? data.source : 'human';
      const role = source === 'human' ? 'user' : 'system';
      const id = typeof data.id === 'string' && data.id ? data.id : createShortId('msg');
      return [{ type: 'message', id, role, content: text, timestamp: now() }];
    }

    case 'tool/call': {
      const callId = typeof data.callId === 'string' ? data.callId : createShortId('call');
      const name = typeof data.name === 'string' ? data.name : 'unknown';
      const rawArgs = typeof data.arguments === 'string' ? data.arguments : '{}';
      return [
        {
          type: 'tool_call',
          id: callId,
          tool: name,
          input: parseArguments(rawArgs),
          timestamp: now(),
        },
      ];
    }

    case 'tool/result': {
      const message = isRecord(data.message) ? data.message : {};
      const callId =
        (typeof message.callId === 'string' && message.callId) ||
        (typeof data.callId === 'string' && data.callId) ||
        createShortId('call');
      const tool =
        (typeof message.name === 'string' && message.name) ||
        (typeof data.name === 'string' && data.name) ||
        'unknown';
      const output = message.content !== undefined ? message.content : data.meta;
      const isError = isRecord(data.error) && typeof data.error.name === 'string';
      return [
        {
          type: 'tool_result',
          toolCallId: callId,
          tool,
          output,
          isError,
          timestamp: now(),
        },
      ];
    }

    case 'todo/write': {
      const todos = Array.isArray(data.todos) ? data.todos : [];
      const events: AgentEvent[] = [];
      for (const todo of todos) {
        if (!isRecord(todo)) continue;
        events.push({
          type: 'task_update',
          task: {
            id: typeof todo.id === 'string' ? todo.id : createShortId('task'),
            title: typeof todo.title === 'string' ? todo.title : typeof todo.content === 'string' ? todo.content : 'task',
            status: typeof todo.status === 'string' ? (todo.status as 'pending') : 'pending',
          },
          timestamp: now(),
        });
      }
      return events;
    }

    case 'command/run': {
      const command = typeof data.command === 'string' ? data.command : '';
      if (!command) return [];
      return [{ type: 'command', command, cwd: typeof data.cwd === 'string' ? data.cwd : undefined, timestamp: now() }];
    }

    case 'approval/asked': {
      return [
        {
          type: 'approval_request',
          id: typeof data.id === 'string' ? data.id : createShortId('approval'),
          category: (typeof data.category === 'string' ? data.category : 'shell') as 'shell',
          action: typeof data.action === 'string' ? data.action : typeof data.request === 'string' ? data.request : 'agent action',
          details: data,
          timestamp: now(),
        },
      ];
    }

    case 'approval/decided': {
      return [
        {
          type: 'approval_result',
          requestId: typeof data.id === 'string' ? data.id : '',
          decision: (typeof data.decision === 'string' ? data.decision : 'allow_once') as 'allow_once',
          timestamp: now(),
        },
      ];
    }

    case 'turn/start':
    case 'turn/end': {
      const index = typeof data.turn === 'number' ? data.turn : 0;
      if (ev.type === 'turn/start') {
        return [{ type: 'turn', phase: 'start', index, timestamp: now() }];
      }
      const reason = isRecord(data.reason) && typeof data.reason.kind === 'string' ? data.reason.kind : undefined;
      return [{ type: 'turn', phase: 'end', index, ...(reason === undefined ? {} : { reason }), timestamp: now() }];
    }

    case 'step/start':
    case 'step/end': {
      const turn = typeof data.turn === 'number' ? data.turn : 0;
      const index = typeof data.step === 'number' ? data.step : 0;
      return [{ type: 'step', phase: ev.type === 'step/start' ? 'start' : 'end', turn, index, timestamp: now() }];
    }

    case 'plan/mode': {
      return [{ type: 'plan_mode', active: data.active === true, details: data, timestamp: now() }];
    }

    case 'compaction/start':
    case 'compaction/end':
    case 'compaction/summary':
    case 'compaction/prune': {
      const phase = ev.type.slice('compaction/'.length) as 'start' | 'end' | 'summary' | 'prune';
      let summary: string | undefined;
      let shadowedTokenCount: number | undefined;
      if (phase === 'summary') {
        // `summary` is an array of message parts; render as best-effort text.
        summary = contentBlocksToText(data.summary) || (typeof data.summary === 'string' ? data.summary : undefined);
        if (typeof data.shadowedTokenCount === 'number') shadowedTokenCount = data.shadowedTokenCount;
      }
      return [
        {
          type: 'compaction',
          phase,
          ...(summary === undefined ? {} : { summary }),
          ...(shadowedTokenCount === undefined ? {} : { shadowedTokenCount }),
          details: data,
          timestamp: now(),
        },
      ];
    }

    case 'request/header': {
      const header = isRecord(data.header) ? data.header : {};
      const config = isRecord(header.config) ? header.config : {};
      const model = typeof config.model === 'string' ? config.model : undefined;
      const reason = isRecord(data.reason) && typeof data.reason.kind === 'string' ? data.reason.kind : undefined;
      return [
        {
          type: 'request_header',
          ...(model === undefined ? {} : { model }),
          ...(reason === undefined ? {} : { reason }),
          details: data,
          timestamp: now(),
        },
      ];
    }

    case 'session/title': {
      const title = typeof data.title === 'string' ? data.title : '';
      if (!title) return [];
      const source = isRecord(data.source) && typeof data.source.kind === 'string' ? data.source.kind : undefined;
      return [{ type: 'session_title', title, ...(source === undefined ? {} : { source }), timestamp: now() }];
    }

    case 'request/context':
    case 'session/end-seed':
    case 'subagent/descriptor':
      // Structural or log-only events: no user-facing mapping.
      return [];

    default:
      return [];
  }
}

/**
 * Normalize one SDK notification (any method) into zero or more AgentEvents.
 */
export function normalizeNotification(
  notification: HarnessNotification,
  defaultSessionId: string,
): AgentEvent[] {
  const { method, params } = notification;
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : defaultSessionId;

  switch (method) {
    case 'session.event':
      return normalizeSessionEvent(params.event, sessionId);

    case 'session.status': {
      const status = params.status === 'running' ? 'running' : 'idle';
      return [{ type: 'status', status, timestamp: now() }];
    }

    case 'subagent.started':
      return [
        {
          type: 'subagent',
          action: 'started',
          childSessionId: String(params.childSessionId ?? ''),
          parentSessionId: String(params.parentSessionId ?? sessionId),
          timestamp: now(),
        },
      ];

    case 'subagent.finished':
      return [
        {
          type: 'subagent',
          action: 'finished',
          childSessionId: String(params.childSessionId ?? ''),
          parentSessionId: String(params.parentSessionId ?? sessionId),
          provider: typeof params.provider === 'string' ? params.provider : undefined,
          status: params.status === 'ok' ? 'ok' : 'error',
          timestamp: now(),
        },
      ];

    default:
      return [];
  }
}
