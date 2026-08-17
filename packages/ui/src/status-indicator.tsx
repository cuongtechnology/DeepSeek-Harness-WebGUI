import * as React from 'react';
import type { AgentStatus } from '@deepseek-harness/shared';
import { cn } from './utils';

const STATUS_STYLES: Record<string, string> = {
  idle: 'bg-zinc-400',
  starting: 'bg-blue-400',
  thinking: 'bg-violet-400',
  running: 'bg-emerald-400 animate-pulse',
  waiting_for_approval: 'bg-amber-400 animate-pulse',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  stopped: 'bg-zinc-500',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  starting: 'Starting',
  thinking: 'Thinking',
  running: 'Running',
  waiting_for_approval: 'Waiting for approval',
  completed: 'Completed',
  failed: 'Failed',
  stopped: 'Stopped',
};

export function StatusDot({ status, className }: { status: AgentStatus; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', STATUS_STYLES[status] ?? 'bg-zinc-400', className)} />;
}

export function StatusIndicator({ status }: { status: AgentStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <StatusDot status={status} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
