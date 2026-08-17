'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Spinner } from '@deepseek-harness/ui';
import type { McpServerPublic } from '@deepseek-harness/shared';

export default function McpSettingsPage() {
  const [servers, setServers] = useState<McpServerPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', command: '', args: '', env: '' });

  async function load() {
    const data = await apiGet<McpServerPublic[]>('/mcp');
    setServers(data);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const env: Record<string, string> = {};
    for (const line of form.env.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && k.trim()) env[k.trim()] = v.join('=');
    }
    await apiPost('/mcp', {
      name: form.name,
      command: form.command,
      args: form.args.split(',').map((a) => a.trim()).filter(Boolean),
      env,
    });
    setShowForm(false);
    setForm({ name: '', command: '', args: '', env: '' });
    await load();
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">MCP Servers</h1>
            <p className="mt-1 text-sm text-zinc-500">Model Context Protocol servers available to your agents.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>Add server</Button>
        </div>

        <div className="mt-4 flex gap-2 text-sm">
          <Link href="/settings/agents" className="px-2 pb-1 text-zinc-500 hover:text-zinc-300">Agents</Link>
          <Link href="/settings/mcp" className="border-b border-blue-500 px-2 pb-1 text-blue-400">MCP servers</Link>
        </div>

        {showForm && (
          <Card className="mt-4 max-w-lg">
            <CardHeader><CardTitle>New MCP server</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={create} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Command</Label><Input required placeholder="npx -y @modelcontextprotocol/server-filesystem" value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Args (comma-separated)</Label><Input placeholder="/path" value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Environment (KEY=value per line)</Label><textarea className="min-h-[80px] w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })} /></div>
                <div className="flex gap-2">
                  <Button type="submit">Add server</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {loading && <div className="flex items-center gap-2 text-zinc-500"><Spinner /> Loading…</div>}
          {servers.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{s.name}</CardTitle>
                  <p className="mt-1 font-mono text-xs text-zinc-500">{s.command} {s.args.join(' ')}</p>
                </div>
                <Badge variant={s.status === 'connected' ? 'success' : s.status === 'error' ? 'destructive' : 'secondary'}>
                  {s.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex flex-wrap gap-1">
                  {s.tools.map((t) => (
                    <Badge key={t.name} variant="secondary">{t.name}</Badge>
                  ))}
                  {s.tools.length === 0 && <span className="text-xs text-zinc-600">No tools discovered</span>}
                </div>
                <div className="flex gap-2">
                  {s.status !== 'connected' ? (
                    <Button size="sm" onClick={() => apiPost(`/mcp/${s.id}/connect`).then(load)}>Connect</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => apiPost(`/mcp/${s.id}/disconnect`).then(load)}>Disconnect</Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => apiDelete(`/mcp/${s.id}`).then(load)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && servers.length === 0 && <p className="text-sm text-zinc-600">No MCP servers configured.</p>}
        </div>
      </div>
    </AppShell>
  );
}
