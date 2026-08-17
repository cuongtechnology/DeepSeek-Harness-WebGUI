/** Well-known constants shared across the monorepo. */

export const WS_NAMESPACE = '/ws';

export const WS_CHANNELS = {
  AGENT: 'agent',
  TERMINAL: 'terminal',
  TASK: 'task',
  PROJECT: 'project',
} as const;

export const REDIS_CHANNELS = {
  AGENT_EVENTS: 'agent:events',
  TASK_EVENTS: 'task:events',
  FILE_CHANGES: 'project:file-changes',
  CONTROL: 'control',
} as const;

export const QUEUE_NAMES = {
  AGENT: 'agent',
  SANDBOX: 'sandbox',
  CLEANUP: 'cleanup',
} as const;

export const DEFAULT_WORKSPACES_ROOT = '.workspaces';

export const DEFAULT_HARNESS_COMMAND = 'deepseek-harness';

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MiB in-editor safety cap

export const MAX_TERMINAL_HISTORY_LINES = 5000;

export const SESSION_COOKIE_NAME = 'dhwg_session';

export const MAX_AGENT_SESSIONS_PER_PROJECT = 10;
