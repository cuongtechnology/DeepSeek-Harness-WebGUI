import { describe, it, expect } from 'vitest';
import { AgentAdapterRegistry } from './registry';
import type { AgentAdapter } from './adapter';

function fakeAdapter(id: string): AgentAdapter {
  return {
    id,
    name: id,
    detect: async () => ({ id, name: id, available: true, version: null }),
    startSession: async () => ({ id: 's1', adapterId: id, status: 'idle' }),
    sendMessage: async () => undefined,
    stopSession: async () => undefined,
    getStatus: async () => 'idle',
    streamEvents: async function* () {
      /* empty */
    },
  };
}

describe('AgentAdapterRegistry', () => {
  it('registers and retrieves adapters', () => {
    const registry = new AgentAdapterRegistry();
    registry.register(fakeAdapter('deepseek-harness'));
    expect(registry.has('deepseek-harness')).toBe(true);
    expect(registry.get('deepseek-harness').name).toBe('deepseek-harness');
  });

  it('lists registered adapters', () => {
    const registry = new AgentAdapterRegistry();
    registry.register(fakeAdapter('a'));
    registry.register(fakeAdapter('b'));
    expect(registry.list().map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('rejects duplicate ids', () => {
    const registry = new AgentAdapterRegistry();
    registry.register(fakeAdapter('dup'));
    expect(() => registry.register(fakeAdapter('dup'))).toThrow(/already registered/);
  });

  it('throws for unknown ids', () => {
    const registry = new AgentAdapterRegistry();
    expect(() => registry.get('missing')).toThrow(/not found/);
  });
});
