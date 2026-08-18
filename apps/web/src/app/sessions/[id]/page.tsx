'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Transcript } from '@/components/Transcript';
import { PlanPanel } from '@/components/PlanPanel';
import { useAgentSession } from '@/lib/useAgentSession';
import { apiGet } from '@/lib/api';
import { Badge, Button } from '@deepseek-harness/ui';
import { extractPlan, extractPlanMode, extractTasks } from '@/lib/transcript';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import type { AgentStatus } from '@deepseek-harness/shared';

interface SessionDetail {
  id: string;
  projectId: string;
  adapterId: string;
  status: AgentStatus;
  title: string | null;
  model: string | null;
  createdAt: string;
  endedAt: string | null;
  project: { id: string; name: string };
}

const TERMINAL: AgentStatus[] = ['completed', 'failed', 'stopped'];

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const socket = useAgentSession(id, { replay: true });
  const [session, setSession] = useState<SessionDetail | null>(null);

  useEffect(() => {
    apiGet<SessionDetail>(`/sessions/${id}`).then(setSession).catch(() => undefined);
  }, [id]);

  const plan = extractPlan(socket.events);
  const tasks = extractTasks(socket.events);
  const planMode = extractPlanMode(socket.events);
  const ended = session ? TERMINAL.includes(session.status) : false;

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
          <Link
            href={session ? `/projects/${session.projectId}` : '/'}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-zinc-100">
                {session?.title || session?.project.name || 'Session'}
              </span>
              {session && <Badge variant="secondary">{session.status}</Badge>}
            </div>
            <p className="truncate text-[11px] text-zinc-500">
              {session?.project.name} · {session?.adapterId} · {session && new Date(session.createdAt).toLocaleString()}
              {session?.endedAt ? ` · ended ${new Date(session.endedAt).toLocaleString()}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {session?.model && <Badge variant="outline">{session.model}</Badge>}
            {session && (
              <Link href={`/projects/${session.projectId}`}>
                <Button size="sm" variant="secondary">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Workspace
                </Button>
              </Link>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
            <PlanPanel plan={plan} tasks={tasks} planMode={planMode} />
          </aside>
          <main className="min-w-0 flex-1">
            <Transcript
              events={socket.events}
              connected={socket.connected}
              sendMessage={socket.sendMessage}
              stop={socket.stop}
              respondApproval={socket.respondApproval}
              showHeader={false}
              readOnly={ended}
            />
          </main>
        </div>
      </div>
    </AppShell>
  );
}
