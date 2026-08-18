import { describe, it, expect } from 'vitest';
import { normalizeSessionEvent, normalizeNotification } from './normalize';

describe('normalizeSessionEvent', () => {
  it('maps assistant/chunk to message_delta', () => {
    const out = normalizeSessionEvent(
      { type: 'assistant/chunk', data: { turn: 1, step: 1, chunk: { type: 'text', text: 'hel' } } },
      's1',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'message_delta', content: 'hel', messageId: 'step-1-1' });
  });

  it('maps assistant/message to a message with concatenated text', () => {
    const out = normalizeSessionEvent(
      {
        type: 'assistant/message',
        data: {
          turn: 1,
          step: 1,
          message: { id: 'am1', content: [{ type: 'text', text: 'hello ' }, { type: 'text', text: 'world' }] },
        },
      },
      's1',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'message', role: 'assistant', id: 'am1', content: 'hello world' });
  });

  it('maps user/message to a user message', () => {
    const out = normalizeSessionEvent(
      { type: 'user/message', data: { id: 'u1', source: 'human', content: [{ type: 'text', text: 'hi' }] } },
      's1',
    );
    expect(out[0]).toMatchObject({ type: 'message', role: 'user', content: 'hi' });
  });

  it('maps injected user/message to a system message', () => {
    const out = normalizeSessionEvent(
      { type: 'user/message', data: { source: 'inject', content: [{ type: 'text', text: 'context' }] } },
      's1',
    );
    expect(out[0]).toMatchObject({ role: 'system' });
  });

  it('maps tool/call, parsing arguments JSON', () => {
    const out = normalizeSessionEvent(
      { type: 'tool/call', data: { turn: 1, step: 1, callId: 'c1', name: 'read_file', arguments: '{"path":"a.ts"}' } },
      's1',
    );
    expect(out[0]).toMatchObject({ type: 'tool_call', id: 'c1', tool: 'read_file', input: { path: 'a.ts' } });
  });

  it('maps tool/result with error flag', () => {
    const out = normalizeSessionEvent(
      {
        type: 'tool/result',
        data: { turn: 1, step: 1, message: { callId: 'c1', name: 'read_file', content: 'boom' }, error: { name: 'ToolError', code: 'E1' } },
      },
      's1',
    );
    expect(out[0]).toMatchObject({ type: 'tool_result', toolCallId: 'c1', isError: true });
  });

  it('maps todo/write to task_update events', () => {
    const out = normalizeSessionEvent(
      { type: 'todo/write', data: { todos: [{ id: 't1', title: 'do a', status: 'completed' }, { id: 't2', title: 'do b', status: 'pending' }] } },
      's1',
    );
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.type === 'task_update')).toBe(true);
  });

  it('maps command/run to a command event', () => {
    const out = normalizeSessionEvent({ type: 'command/run', data: { command: 'npm install', cwd: '/w' } }, 's1');
    expect(out[0]).toMatchObject({ type: 'command', command: 'npm install' });
  });

  it('maps approval/asked and approval/decided', () => {
    const asked = normalizeSessionEvent(
      { type: 'approval/asked', data: { id: 'ap1', category: 'shell', action: 'rm -rf dist' } },
      's1',
    );
    expect(asked[0]).toMatchObject({ type: 'approval_request', category: 'shell' });
    const decided = normalizeSessionEvent({ type: 'approval/decided', data: { id: 'ap1', decision: 'allow_once' } }, 's1');
    expect(decided[0]).toMatchObject({ type: 'approval_result', decision: 'allow_once' });
  });

  it('maps plan/mode to plan_mode', () => {
    const on = normalizeSessionEvent({ type: 'plan/mode', data: { active: true } }, 's1');
    expect(on[0]).toMatchObject({ type: 'plan_mode', active: true });
    const off = normalizeSessionEvent({ type: 'plan/mode', data: { active: false } }, 's1');
    expect(off[0]).toMatchObject({ type: 'plan_mode', active: false });
  });

  it('maps turn/start and turn/end with reason', () => {
    const start = normalizeSessionEvent({ type: 'turn/start', data: { turn: 2 } }, 's1');
    expect(start[0]).toMatchObject({ type: 'turn', phase: 'start', index: 2 });
    const end = normalizeSessionEvent({ type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } }, 's1');
    expect(end[0]).toMatchObject({ type: 'turn', phase: 'end', index: 2, reason: 'completed' });
  });

  it('maps step/start and step/end', () => {
    const out = normalizeSessionEvent({ type: 'step/start', data: { turn: 2, step: 3 } }, 's1');
    expect(out[0]).toMatchObject({ type: 'step', phase: 'start', turn: 2, index: 3 });
  });

  it('maps compaction lifecycle events', () => {
    const start = normalizeSessionEvent({ type: 'compaction/start', data: { turn: null } }, 's1');
    expect(start[0]).toMatchObject({ type: 'compaction', phase: 'start' });
    const summary = normalizeSessionEvent(
      { type: 'compaction/summary', data: { summary: [{ type: 'text', text: 'folded' }], shadowedTokenCount: 4200 } },
      's1',
    );
    expect(summary[0]).toMatchObject({ type: 'compaction', phase: 'summary', summary: 'folded', shadowedTokenCount: 4200 });
    const end = normalizeSessionEvent({ type: 'compaction/end', data: { turn: null } }, 's1');
    expect(end[0]).toMatchObject({ type: 'compaction', phase: 'end' });
  });

  it('maps request/header with model and reason', () => {
    const out = normalizeSessionEvent(
      { type: 'request/header', data: { header: { config: { model: 'deepseek-v4-flash' } }, reason: { kind: 'user' } } },
      's1',
    );
    expect(out[0]).toMatchObject({ type: 'request_header', model: 'deepseek-v4-flash', reason: 'user' });
  });

  it('maps session/title with source', () => {
    const out = normalizeSessionEvent(
      { type: 'session/title', data: { title: 'Fix the build', messageSeqs: [1], source: { kind: 'provider' } } },
      's1',
    );
    expect(out[0]).toMatchObject({ type: 'session_title', title: 'Fix the build', source: 'provider' });
  });

  it('carries token usage on assistant/message', () => {
    const out = normalizeSessionEvent(
      {
        type: 'assistant/message',
        data: {
          turn: 1,
          step: 1,
          message: { id: 'am1', content: [{ type: 'text', text: 'hi' }] },
          usage: { input: 1200, output: 340, total: 1540 },
        },
      },
      's1',
    );
    expect(out[0]).toMatchObject({ type: 'message', usage: { input: 1200, output: 340, total: 1540 } });
  });

  it('drops structural events and unknown types', () => {
    for (const type of ['request/context', 'session/end-seed', 'subagent/descriptor', 'mystery/event']) {
      expect(normalizeSessionEvent({ type }, 's1')).toEqual([]);
    }
  });
});

describe('normalizeNotification', () => {
  it('maps session.status', () => {
    const out = normalizeNotification({ method: 'session.status', params: { sessionId: 's1', status: 'running' } }, 's1');
    expect(out[0]).toMatchObject({ type: 'status', status: 'running' });
  });

  it('maps subagent.started / subagent.finished', () => {
    const started = normalizeNotification(
      { method: 'subagent.started', params: { parentSessionId: 'p', childSessionId: 'c' } },
      'p',
    );
    expect(started[0]).toMatchObject({ type: 'subagent', action: 'started', childSessionId: 'c' });

    const finished = normalizeNotification(
      { method: 'subagent.finished', params: { parentSessionId: 'p', childSessionId: 'c', provider: 'subagent', status: 'ok' } },
      'p',
    );
    expect(finished[0]).toMatchObject({ type: 'subagent', action: 'finished', status: 'ok' });
  });

  it('passes session.event through to normalizeSessionEvent', () => {
    const out = normalizeNotification(
      { method: 'session.event', params: { sessionId: 's1', event: { type: 'tool/call', data: { callId: 'c1', name: 'bash', arguments: '{}' } } } },
      's1',
    );
    expect(out[0]).toMatchObject({ type: 'tool_call' });
  });

  it('ignores unknown notification methods', () => {
    expect(normalizeNotification({ method: 'other/thing', params: {} }, 's1')).toEqual([]);
  });
});
