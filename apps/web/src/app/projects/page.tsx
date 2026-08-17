'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Spinner } from '@deepseek-harness/ui';

interface Project {
  id: string;
  name: string;
  description: string | null;
  sourceKind: string;
  sandboxKind: string;
  workspacePath: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', sourceKind: 'empty', sourceUrl: '' });

  async function load() {
    const data = await apiGet<Project[]>('/projects');
    setProjects(data);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await apiPost('/projects', {
      name: form.name,
      description: form.description || undefined,
      sourceKind: form.sourceKind,
      sourceUrl: form.sourceUrl || undefined,
    });
    setShowForm(false);
    setForm({ name: '', description: '', sourceKind: 'empty', sourceUrl: '' });
    await load();
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Projects</h1>
            <p className="mt-1 text-sm text-zinc-500">Workspaces for your agents.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>New project</Button>
        </div>

        {showForm && (
          <Card className="mt-4 max-w-md">
            <CardHeader>
              <CardTitle>New project</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={create} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <select
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.sourceKind}
                    onChange={(e) => setForm({ ...form, sourceKind: e.target.value })}
                  >
                    <option value="empty">Empty workspace</option>
                    <option value="git">Git repository</option>
                  </select>
                </div>
                {form.sourceKind === 'git' && (
                  <div className="space-y-1.5">
                    <Label>Repository URL</Label>
                    <Input
                      required
                      placeholder="https://github.com/…"
                      value={form.sourceUrl}
                      onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="submit">Create project</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {loading && (
            <div className="col-span-full flex items-center gap-2 text-zinc-500">
              <Spinner /> Loading…
            </div>
          )}
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="transition-colors hover:border-zinc-600">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    <Badge variant="secondary">{p.sandboxKind}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-zinc-500">
                  <p className="font-mono">{p.workspacePath}</p>
                  <p>{p.description || '—'}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!loading && projects.length === 0 && (
            <p className="col-span-full text-sm text-zinc-600">No projects yet. Create one above.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
