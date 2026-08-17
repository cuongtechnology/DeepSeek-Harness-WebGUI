export type ProjectSource =
  | { kind: 'empty' }
  | { kind: 'git'; url: string; branch?: string }
  | { kind: 'local'; path: string };

export type SandboxKind = 'host' | 'docker';

export interface SandboxOptions {
  projectId: string;
  image?: string;
  workspacePath: string;
  env?: Record<string, string>;
  networkDisabled?: boolean;
}

export interface SandboxInfo {
  id: string;
  status: 'creating' | 'running' | 'stopped' | 'destroyed' | 'error';
  containerId?: string;
  workspacePath: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  workspacePath: string;
  source: ProjectSource;
  sandboxKind: SandboxKind;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceFileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

export interface FileReadResult {
  path: string;
  content: string;
  truncated: boolean;
  size: number;
}

export interface ProjectStatus {
  id: string;
  name: string;
  activeSessionCount: number;
  taskCount: number;
  gitBranch: string | null;
  dirtyFiles: number;
  cpuPercent: number | null;
  memoryBytes: number | null;
}
