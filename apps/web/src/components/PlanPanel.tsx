'use client';

import type { PlanDisplayItem, TaskDisplayItem } from '@/lib/transcript';
import { ClipboardList, ListChecks, Circle, CheckCircle2, CircleDot, XCircle } from 'lucide-react';

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (status === 'in_progress' || status === 'running') return <CircleDot className="h-3.5 w-3.5 shrink-0 animate-pulse text-blue-400" />;
  if (status === 'cancelled' || status === 'failed') return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
  return <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-600" />;
}

/** Left-hand plan + task sidebar for the session detail page. */
export function PlanPanel({ plan, tasks, planMode }: { plan: PlanDisplayItem[]; tasks: TaskDisplayItem[]; planMode?: boolean | null }) {
  return (
    <div className="space-y-6">
      {planMode !== undefined && planMode !== null && (
        <div
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
            planMode ? 'border-amber-600/40 bg-amber-950/30 text-amber-300' : 'border-zinc-800 bg-zinc-900/50 text-zinc-500'
          }`}
        >
          <ListChecks className="h-3.5 w-3.5 shrink-0" />
          {planMode ? 'Plan mode is ON' : 'Plan mode is OFF'}
        </div>
      )}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <ClipboardList className="h-3.5 w-3.5" /> Plan
        </h3>
        {plan.length === 0 ? (
          <p className="text-xs text-zinc-600">No plan yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {plan.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-xs">
                <StatusIcon status={item.status} />
                <span className={item.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}>{item.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <ListChecks className="h-3.5 w-3.5" /> Tasks
        </h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-zinc-600">No tasks yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-xs">
                <StatusIcon status={item.status} />
                <span className={item.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}>{item.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
