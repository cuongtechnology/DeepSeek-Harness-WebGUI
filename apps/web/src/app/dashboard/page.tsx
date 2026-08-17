'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet } from '@/lib/api';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from '@deepseek-harness/ui';
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
  version: string | null;
  reason?: string;
}

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

  const activeSessions = sessions.filter((s) => ['running', 'thinking', 'starting', 'waiting_for_approval'].includes(s.status));

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Control plane for your AI coding agents.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Agent Runtimes</CardTitle>
              <CardDescription>Installed runtimes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {runtimes.map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-sm">{r.name}</span>
                  <Badge variant={r.available ? 'success' : 'destructive'}>
                    {r.available ? `available${r.version ? ` v${r.version}` : ''}` : 'unavailable'}
                  </Badge>
                </div>
              ))}
              {runtimes.length === 0 && <p className="text-sm text-zinc-600">No runtimes detected.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Running agents</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{activeSessions.length}</p>
              <Link href="/sessions" className="text-xs text-blue-400 hover:underline">
                View all sessions →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Workspaces</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{projects.length}</p>
              <Link href="/projects" className="text-xs text-blue-400 hover:underline">
                Manage projects →
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Recent projects</h2>
            <Link href="/projects">
              <Button size="sm" variant="secondary">New project</Button>
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="transition-colors hover:border-zinc-600">
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{p.description || p.sandboxKind}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
            {projects.length === 0 && (
              <p className="col-span-full text-sm text-zinc-600">
                No projects yet.{' '}
                <Link href="/projects" className="text-blue-400 hover:underline">
                  Create your first project
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
