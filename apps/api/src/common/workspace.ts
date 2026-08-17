import { resolve, join } from 'node:path';

/** Root directory under which all project workspaces live. */
export function workspaceRoot(): string {
  return resolve(process.env.WORKSPACES_ROOT ?? '.workspaces');
}

/** Absolute workspace path for a project. */
export function projectWorkspace(projectId: string): string {
  return join(workspaceRoot(), projectId);
}
