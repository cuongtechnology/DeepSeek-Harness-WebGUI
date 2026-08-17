'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet } from '@/lib/api';
import { Badge, Card, CardContent, Spinner, StatusIndicator } from '@deepseek-harness/ui';
import { MessageSquare, Search, ChevronRight } from 'lucide-react';
import type { AgentStatus } from '@deepseek-harness/shared';

interface Session {
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

const ACTIVE: AgentStatus[] = ['running', 'thinking', 'starting', 'waiting_for_approval'];

const FILTERS: { id: 'all' | 'active' | 'ended'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'ended', label: 'Ended' },
];

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    apiGet<Session[]>('/sessions')
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = sessions;
    if (filter === 'active') list = list.filter((s) => ACTIVE.includes(s.status));
    else if (filter === 'ended') list = list.filter((s) => !ACTIVE.includes(s.status));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) =>
        [s.project.name, s.title ?? '', s.adapterId, s.model ?? '', s.id].some((v) => v.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [sessions, filter, query]);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
            <p className="mt-1 text-sm text-zinc-500">Every agent session across your projects.</p>
          </div>
          <Link href="/projects">
            <Badge variant="outline" className="h-8 px-3">
              Open a project to start one
            </Badge>
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-zinc-800 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 sm:max-w-xs">
            <Search className="h-4 w-4 shrink-0 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions…"
              className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <MessageSquare className="h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">
                  {sessions.length === 0 ? 'No sessions yet. Open a project to start an agent.' : 'No sessions match your filter.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <Link key={s.id} href={`/sessions/${s.id}`}>
                  <Card className="transition-colors hover:border-zinc-600">
                    <CardContent className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{s.title || s.project.name}</p>
                          {s.model && <Badge variant="secondary">{s.model}</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {s.project.name} · {s.adapterId} · {new Date(s.createdAt).toLocaleString()}
                          {s.endedAt ? ` · ended ${new Date(s.endedAt).toLocaleString()}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusIndicator status={s.status} />
                        <ChevronRight className="h-4 w-4 text-zinc-600" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
