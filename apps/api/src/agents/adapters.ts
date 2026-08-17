import { AgentAdapterRegistry, type AgentAdapter } from '@deepseek-harness/agent-sdk';
import { DeepSeekHarnessAdapter } from '@deepseek-harness/harness';

/**
 * Registry of available agent runtimes. Adding a new runtime (Claude Code,
 * Codex, OpenHands, custom) means implementing AgentAdapter and registering it
 * here — nothing else in the application changes.
 */
export function createAdapterRegistry(): AgentAdapterRegistry {
  const registry = new AgentAdapterRegistry();
  registry.register(new DeepSeekHarnessAdapter());
  return registry;
}

export { AgentAdapterRegistry, type AgentAdapter };
