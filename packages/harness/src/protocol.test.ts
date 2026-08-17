import { describe, it, expect } from 'vitest';
import { SdkRuntimeClient, textBlock } from './protocol';

/**
 * A minimal JSON-RPC runtime server exercised through `node -e`. This is a
 * protocol-level integration test: it drives the actual wire format the
 * official `dsh-jsonrpc-agent` runtime speaks.
 */
const FAKE_RUNTIME = `
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.method === 'initialize') {
    out({ jsonrpc: '2.0', id: m.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.1.0' } } });
  } else if (m.method === 'session/prompt') {
    out({ jsonrpc: '2.0', id: m.id, result: { messageId: 'm1' } });
    not('session.status', { sessionId: m.params.sessionId, status: 'running' });
    not('session.event', { sessionId: m.params.sessionId, event: { type: 'assistant/chunk', seq: 1, time: 1, data: { turn: 1, step: 1, chunk: { type: 'text', text: 'hi' } } } });
    not('session.status', { sessionId: m.params.sessionId, status: 'idle' });
  } else if (m.method === 'shutdown') {
    out({ jsonrpc: '2.0', id: m.id, result: {} });
    setTimeout(() => process.exit(0), 20);
  }
});
function out(x) { process.stdout.write(JSON.stringify(x) + '\\n'); }
function not(method, params) { out({ jsonrpc: '2.0', method, params }); }
`;

function newClient() {
  return new SdkRuntimeClient({
    command: process.execPath,
    args: ['-e', FAKE_RUNTIME],
    requestTimeoutMs: 3000,
    disposeGraceMs: 50,
  });
}

describe('SdkRuntimeClient', () => {
  it('initializes and reports the server identity', async () => {
    const client = newClient();
    const result = await client.initialize({ cwd: '/tmp', provider: 'deepseek-official', model: 'deepseek-v4-flash' });
    expect(result.serverInfo.name).toBe('deepseek-harness-sdk-runtime');
    await client.close();
  });

  it('prompts and streams notifications', async () => {
    const client = newClient();
    await client.initialize({ cwd: '/tmp', provider: 'p', model: 'm' });

    const sub = client.subscribe();
    const messageId = await client.prompt('s-1', [textBlock('hello')]);
    expect(messageId).toBe('m1');

    const methods: string[] = [];
    const collected: unknown[] = [];
    for await (const n of sub) {
      methods.push(n.method);
      collected.push(n);
      if (methods.filter((x) => x === 'session.status').length >= 2) break;
    }
    expect(methods).toContain('session.status');
    expect(methods).toContain('session.event');
    await client.close();
  });

  it('rejects a request when the runtime dies', async () => {
    const dying = `
      const rl = require('node:readline').createInterface({ input: process.stdin });
      rl.on('line', () => { setTimeout(() => process.exit(1), 10); });
    `;
    const client = new SdkRuntimeClient({
      command: process.execPath,
      args: ['-e', dying],
      requestTimeoutMs: 2000,
      disposeGraceMs: 50,
    });
    await expect(client.initialize({ cwd: '/tmp', provider: 'p', model: 'm' })).rejects.toThrow();
    await client.close();
  });
});
