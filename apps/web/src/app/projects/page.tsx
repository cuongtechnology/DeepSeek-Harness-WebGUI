'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Spinner } from '@deepseek-harness/ui';
import { FolderGit2, Plus, X, Globe, Folder, Box } from 'lucide-react';

type SourceKind = 'empty' | 'git' | 'local';

interface Project {
  id: string;
  name: string;
  description: string | null;
  sourceKind: string;
  sandboxKind: string;
  workspacePath: string;
  createdAt: string;
}

const SOURCE_KINDS: { value: SourceKind; label: string; icon: typeof Box }[] = [
  { value: 'empty', label: 'Empty', icon: Box },
  { value: 'git', label: 'Git repo', icon: Globe },
  { value: 'local', label: 'Local dir', icon: Folder },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sourceKind: 'empty' as SourceKind,
    sourceUrl: '',
    sourceBranch: '',
    sourcePath: '',
    sandboxKind: 'host',
  });

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
    setBusy(true);
    setError(null);
    try {
      await apiPost('/projects', {
        name: form.name,
        description: form.description || undefined,
        sourceKind: form.sourceKind,
        sourceUrl: form.sourceKind === 'git' ? form.sourceUrl || undefined : undefined,
        sourceBranch: form.sourceKind === 'git' ? form.sourceBranch || undefined : undefined,
        sourcePath: form.sourceKind === 'local' ? form.sourcePath || undefined : undefined,
        sandboxKind: form.sandboxKind,
      });
      setShowForm(false);
      setForm({ name: '', description: '', sourceKind: 'empty', sourceUrl: '', sourceBranch: '', sourcePath: '', sandboxKind: 'host' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-zinc-500">Workspaces for your agents.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
            {showForm ? 'Close' : 'New project'}
          </Button>
        </div>

        {showForm && (
          <Card className="mt-6 max-w-lg">
            <CardHeader>
              <CardTitle>New project</CardTitle>
              <CardDescription>Create a workspace from a Git repository, a local directory, or an empty folder.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-project" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
                </div>

                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
                    {SOURCE_KINDS.map((k) => {
                      const Icon = k.icon;
                      const active = form.sourceKind === k.value;
                      return (
                        <button
                          key={k.value}
                          type="button"
                          onClick={() => setForm({ ...form, sourceKind: k.value })}
                          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                            active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {k.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.sourceKind === 'git' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sourceUrl">Repository URL</Label>
                      <Input id="sourceUrl" required placeholder="https://github.com/owner/repo.git" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sourceBranch">Branch (optional)</Label>
                      <Input id="sourceBranch" placeholder="main" value={form.sourceBranch} onChange={(e) => setForm({ ...form, sourceBranch: e.target.value })} />
                    </div>
                  </div>
                )}

                {form.sourceKind === 'local' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sourcePath">Local directory path</Label>
                    <Input id="sourcePath" required placeholder="/absolute/path/to/project" value={form.sourcePath} onChange={(e) => setForm({ ...form, sourcePath: e.target.value })} />
                    <p className="text-xs text-zinc-600">The directory is copied into the workspace.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="sandboxKind">Sandbox</Label>
                  <select
                    id="sandboxKind"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.sandboxKind}
                    onChange={(e) => setForm({ ...form, sandboxKind: e.target.value })}
                  >
                    <option value="host">Host (no isolation)</option>
                    <option value="docker">Docker container</option>
                  </select>
                </div>

                {error && <p className="rounded-md bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}

                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    {busy ? <Spinner className="h-4 w-4" /> : 'Create project'}
                  </Button>
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
              <Card className="h-full transition-colors hover:border-zinc-600">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 truncate">
                      <FolderGit2 className="h-4 w-4 shrink-0 text-zinc-500" />
                      {p.name}
                    </CardTitle>
                    <Badge variant="secondary">{p.sandboxKind}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-zinc-500">
                  <p className="truncate">{p.description || 'No description'}</p>
                  <p className="truncate font-mono text-zinc-600">{p.workspacePath}</p>
                  <p>{new Date(p.createdAt).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!loading && projects.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <FolderGit2 className="h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">No projects yet. Create one above.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
