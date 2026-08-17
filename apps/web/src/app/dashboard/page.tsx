'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet } from '@/lib/api';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner, StatusIndicator } from '@deepseek-harness/ui';
import { Plus, MessageSquare, FolderGit2, Zap, ArrowRight, Cpu } from 'lucide-react';
import type { AgentStatus } from '@deepseek-harness/shared';

interface Project {
  id: string;
  name: string;
  description: string | null;
  sandboxKind: string;
  updatedAt: string;
}

interface Session {
  id: string;
  projectId: string;
  adapterId: string;
  status: AgentStatus;
  project: { id: string; name: string };
  createdAt: string;
}

interface Runtime {
  id: string;
  name: string;
  available: boolean;
  installable?: boolean;
}

const ACTIVE: AgentStatus[] = ['running', 'thinking', 'starting', 'waiting_for_approval'];

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGet<Project[]>('/projects'), apiGet<Session[]>('/sessions'), apiGet<Runtime[]>('/agents')])
      .then(([p, s, r]) => {
        setProjects(p);
        setSessions(s);
        setRuntimes(r);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center text-zinc-500">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  const activeSessions = sessions.filter((s) => ACTIVE.includes(s.status));
  const runtime = runtimes[0];
  const recentSessions = sessions.slice(0, 5);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Your agent control plane.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/projects">
              <Button variant="outline">
                <MessageSquare className="mr-1.5 h-4 w-4" /> New agent session
              </Button>
            </Link>
            <Link href="/projects">
              <Button>
                <Plus className="mr-1.5 h-4 w-4" /> New project
              </Button>
            </Link>
          </div>
        </div>

        {runtime && !runtime.available && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-300">DeepSeek Harness is not installed</p>
                <p className="text-xs text-zinc-500">Install the runtime to start agent sessions.</p>
              </div>
            </div>
            <Link href="/settings/agents">
              <Button size="sm">Install</Button>
            </Link>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-zinc-500" /> Agent runtime
              </CardTitle>
              <Badge variant={runtime?.available ? 'success' : 'warning'}>
                {runtime?.available ? 'ready' : 'missing'}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{runtime?.name ?? '—'}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {runtime?.available ? 'Installed and detected' : 'Not detected on this host'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-zinc-500" /> Active sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{activeSessions.length}</p>
              <Link href="/sessions" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-zinc-500" /> Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{projects.length}</p>
              <Link href="/projects" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Recent projects</h2>
            <Link href="/projects" className="text-xs text-blue-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full transition-colors hover:border-zinc-600">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="truncate">{p.name}</CardTitle>
                      <Badge variant="secondary">{p.sandboxKind}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{p.description || 'No description'}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
            {projects.length === 0 && (
              <Card className="col-span-full border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <FolderGit2 className="h-8 w-8 text-zinc-600" />
                  <p className="text-sm text-zinc-500">No projects yet.</p>
                  <Link href="/projects">
                    <Button size="sm">Create your first project</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Recent sessions</h2>
            <Link href="/sessions" className="text-xs text-blue-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {recentSessions.map((s) => (
              <Link key={s.id} href={`/sessions/${s.id}`}>
                <Card className="transition-colors hover:border-zinc-600">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.project.name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {s.adapterId} · {new Date(s.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusIndicator status={s.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
            {recentSessions.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-zinc-600" />
                  <p className="text-sm text-zinc-500">No sessions yet. Open a project to start an agent.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
