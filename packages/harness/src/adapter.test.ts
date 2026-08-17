import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentEvent } from '@deepseek-harness/shared';
import { DeepSeekHarnessAdapter } from './adapter';

const FAKE_RUNTIME = `
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.method === 'initialize') {
    out({ jsonrpc: '2.0', id: m.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.1.0' } } });
  } else if (m.method === 'session/prompt') {
    out({ jsonrpc: '2.0', id: m.id, result: { messageId: 'm1' } });
    const sid = m.params.sessionId;
    not('session.status', { sessionId: sid, status: 'running' });
    not('session.event', { sessionId: sid, event: { type: 'assistant/chunk', seq: 1, time: 1, data: { turn: 1, step: 1, chunk: { type: 'text', text: 'hello ' } } } });
    not('session.event', { sessionId: sid, event: { type: 'tool/call', seq: 2, time: 2, data: { turn: 1, step: 1, callId: 'c1', name: 'read_file', arguments: '{"path":"a.ts"}' } } });
    not('session.event', { sessionId: sid, event: { type: 'tool/result', seq: 3, time: 3, data: { turn: 1, step: 1, message: { callId: 'c1', name: 'read_file', content: 'hi' } } } });
    not('session.event', { sessionId: sid, event: { type: 'assistant/message', seq: 4, time: 4, data: { turn: 1, step: 1, message: { id: 'am1', content: [{ type: 'text', text: 'hello world' }] } } } });
    not('session.status', { sessionId: sid, status: 'idle' });
  } else if (m.method === 'shutdown') {
    out({ jsonrpc: '2.0', id: m.id, result: {} });
    setTimeout(() => process.exit(0), 20);
  }
});
function out(x) { process.stdout.write(JSON.stringify(x) + '\\n'); }
function not(method, params) { out({ jsonrpc: '2.0', method, params }); }
`;

const CRASH_RUNTIME = `
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.method === 'initialize') {
    out({ jsonrpc: '2.0', id: m.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.1.0' } } });
    setTimeout(() => process.exit(1), 30);
  }
});
function out(x) { process.stdout.write(JSON.stringify(x) + '\\n'); }
`;

function makeAdapter(script = FAKE_RUNTIME): DeepSeekHarnessAdapter {
  return new DeepSeekHarnessAdapter({
    command: process.execPath,
    args: ['-e', script],
    requestTimeoutMs: 3000,
    disposeGraceMs: 50,
  });
}

const active: DeepSeekHarnessAdapter[] = [];

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
}

afterEach(async () => {
  for (const adapter of active.splice(0)) {
    await adapter.disposeAll();
  }
});

describe('DeepSeekHarnessAdapter', () => {
  it('detect() reports an unavailable binary', async () => {
    const adapter = new DeepSeekHarnessAdapter({ command: '/definitely/not/a/real/runtime' });
    const info = await adapter.detect();
    expect(info.available).toBe(false);
    expect(info.reason).toMatch(/not found|not executable/);
  });

  it('detect() reports an available binary', async () => {
    const adapter = makeAdapter();
    const info = await adapter.detect();
    expect(info.available).toBe(true);
    expect(info.command).toBe(process.execPath);
  });

  it('runs a full session lifecycle over the JSON-RPC protocol', async () => {
    const adapter = makeAdapter();
    active.push(adapter);

    const dir = mkdtempSync(join(tmpdir(), 'dhwg-harness-'));
    const events: AgentEvent[] = [];

    const session = await adapter.startSession({
      sessionId: 's-live',
      projectId: 'p1',
      workspacePath: dir,
      onEvent: (e) => void events.push(e),
    });
    expect(session.adapterId).toBe('deepseek-harness');

    await adapter.sendMessage('s-live', 'please read a.ts');

    await waitFor(() => events.some((e) => e.type === 'message' && e.role === 'assistant'));

    const types = events.map((e) => e.type);
    expect(types).toContain('session_started');
    expect(types).toContain('message_delta');
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('message');

    const toolCall = events.find((e) => e.type === 'tool_call');
    expect(toolCall).toMatchObject({ tool: 'read_file', input: { path: 'a.ts' } });

    expect(await adapter.getStatus('s-live')).toBe('idle');

    await adapter.stopSession('s-live');
    await waitFor(() => events.some((e) => e.type === 'session_ended'));
    expect(await adapter.getStatus('s-live')).toBe('stopped');

    rmSync(dir, { recursive: true, force: true });
  });

  it('marks the session failed when the runtime dies unexpectedly', async () => {
    const adapter = makeAdapter(CRASH_RUNTIME);
    active.push(adapter);
    const dir = mkdtempSync(join(tmpdir(), 'dhwg-harness-'));

    const events: AgentEvent[] = [];
    await adapter.startSession({
      sessionId: 's-crash',
      projectId: 'p1',
      workspacePath: dir,
      onEvent: (e) => void events.push(e),
    });

    await waitFor(() => events.some((e) => e.type === 'session_ended'));
    expect(await adapter.getStatus('s-crash')).toBe('failed');
    rmSync(dir, { recursive: true, force: true });
  });
});
