import { Injectable } from '@nestjs/common';
import {
  DEFAULT_PERMISSION_POLICIES,
  type PermissionCategory,
  type PermissionDecision,
  type PermissionPolicy,
  type PermissionPolicyMap,
} from '@deepseek-harness/shared';

/**
 * Per-project permission policy store. Policies default to the shared
 * {@link DEFAULT_PERMISSION_POLICIES} and can be overridden per project. They
 * gate sensitive operations (shell, filesystem, network, git, package install)
 * before execution, and drive the approval workflow.
 */
@Injectable()
export class PermissionsService {
  private readonly overrides = new Map<string, Partial<PermissionPolicyMap>>();

  getPolicies(projectId: string): PermissionPolicyMap {
    return { ...DEFAULT_PERMISSION_POLICIES, ...(this.overrides.get(projectId) ?? {}) };
  }

  setPolicy(projectId: string, category: PermissionCategory, policy: PermissionPolicy): void {
    const current = this.overrides.get(projectId) ?? {};
    this.overrides.set(projectId, { ...current, [category]: policy });
  }

  setPolicies(projectId: string, policies: Partial<PermissionPolicyMap>): void {
    this.overrides.set(projectId, { ...(this.overrides.get(projectId) ?? {}), ...policies });
  }

  /**
   * Evaluate a proposed action. Returns an immediate decision when the policy
   * is `always_allow`/`deny`, or `null` when a human must decide (`ask`).
   */
  evaluate(projectId: string, category: PermissionCategory): PermissionDecision | null {
    const policy = this.getPolicies(projectId)[category];
    if (policy === 'always_allow') return 'allow_always';
    if (policy === 'deny') return 'deny';
    return null;
  }
}
