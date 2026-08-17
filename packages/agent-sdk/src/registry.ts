import type { AgentAdapter } from './adapter';
import { AdapterNotFoundError, DuplicateAdapterError } from './errors';

/**
 * Registry of available agent adapters. The API composes adapters here at
 * bootstrap; adding a new runtime is a matter of implementing AgentAdapter and
 * registering it.
 */
export class AgentAdapterRegistry {
  private readonly adapters = new Map<string, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new DuplicateAdapterError(adapter.id);
    }
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): AgentAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new AdapterNotFoundError(id);
    }
    return adapter;
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }

  list(): AgentAdapter[] {
    return [...this.adapters.values()];
  }

  get ids(): string[] {
    return [...this.adapters.keys()];
  }
}
