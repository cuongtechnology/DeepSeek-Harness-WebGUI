'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet } from '@/lib/api';
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from '@deepseek-harness/ui';

interface Runtime {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  available: boolean;
  version: string | null;
  command?: string;
  reason?: string;
}

export default function AgentsSettingsPage() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Runtime[]>('/agents')
      .then(setRuntimes)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-6">
        <h1 className="text-xl font-semibold">Agent Runtimes</h1>
        <p className="mt-1 text-sm text-zinc-500">Configured agent runtimes and their availability.</p>

        <div className="mt-4 flex gap-2 text-sm">
          <Link href="/settings/agents" className="border-b border-blue-500 px-2 pb-1 text-blue-400">Agents</Link>
          <Link href="/settings/mcp" className="px-2 pb-1 text-zinc-500 hover:text-zinc-300">MCP servers</Link>
        </div>

        <div className="mt-6 space-y-3">
          {loading && <div className="flex items-center gap-2 text-zinc-500"><Spinner /> Loading…</div>}
          {runtimes.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{r.name}</CardTitle>
                  <p className="mt-1 text-xs text-zinc-500">{r.description}</p>
                </div>
                <Badge variant={r.available ? 'success' : 'destructive'}>
                  {r.available ? 'available' : 'unavailable'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-zinc-500">
                <p>Command: <span className="font-mono text-zinc-300">{r.command ?? '—'}</span></p>
                {r.version && <p>Version: {r.version}</p>}
                {!r.available && r.reason && <p className="text-red-400">{r.reason}</p>}
                <div className="flex flex-wrap gap-1">
                  {r.capabilities.map((c) => (
                    <Badge key={c} variant="secondary">{c}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && runtimes.length === 0 && <p className="text-sm text-zinc-600">No runtimes registered.</p>}
        </div>
      </div>
    </AppShell>
  );
}
