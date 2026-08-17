'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet } from '@/lib/api';
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from '@deepseek-harness/ui';
import type { AgentStatus } from '@deepseek-harness/shared';

interface Session {
  id: string;
  projectId: string;
  adapterId: string;
  status: AgentStatus;
  title: string | null;
  project: { id: string; name: string };
  createdAt: string;
}

function badgeVariant(status: AgentStatus): 'success' | 'destructive' | 'info' | 'warning' | 'secondary' {
  switch (status) {
    case 'running':
    case 'thinking':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'waiting_for_approval':
      return 'warning';
    case 'completed':
      return 'info';
    default:
      return 'secondary';
  }
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Session[]>('/sessions')
      .then(setSessions)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-6">
        <h1 className="text-xl font-semibold">Sessions</h1>
        <p className="mt-1 text-sm text-zinc-500">Agent sessions across your projects.</p>

        <div className="mt-6 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-zinc-500">
              <Spinner /> Loading…
            </div>
          )}
          {sessions.map((s) => (
            <Link key={s.id} href={`/sessions/${s.id}`}>
              <Card className="transition-colors hover:border-zinc-600">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{s.title ?? s.id}</CardTitle>
                    <p className="mt-1 text-xs text-zinc-500">
                      {s.project.name} · {s.adapterId} · {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={badgeVariant(s.status)}>{s.status}</Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
          {!loading && sessions.length === 0 && (
            <p className="text-sm text-zinc-600">
              No sessions yet. Open a project and start an agent.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
