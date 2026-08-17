'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@deepseek-harness/ui';

interface Runtime {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  available: boolean;
  version: string | null;
  command?: string;
  reason?: string;
  installable: boolean;
  installMethods: string[];
}

interface InstallResult {
  success: boolean;
  command?: string;
  configPath?: string;
  error?: string;
  output?: string;
}

export default function AgentsSettingsPage() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<{ id: string; method: string } | null>(null);
  const [results, setResults] = useState<Record<string, InstallResult>>({});

  const refresh = useCallback(() => {
    apiGet<Runtime[]>('/agents')
      .then(setRuntimes)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const install = async (id: string, method: string) => {
    setInstalling({ id, method });
    try {
      const res = await apiPost<InstallResult>(`/agents/${id}/install`, { method });
      setResults((prev) => ({ ...prev, [id]: res }));
      await refresh();
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [id]: { success: false, error: error instanceof Error ? error.message : String(error) },
      }));
    } finally {
      setInstalling(null);
    }
  };

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
          {runtimes.map((r) => {
            const isInstalling = installing?.id === r.id;
            const result = results[r.id];
            return (
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

                  {!r.available && r.installable && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-xs font-medium text-amber-300">DeepSeek Harness is not installed.</p>
                      <p className="mt-1 text-xs text-zinc-400">Install it now? This downloads the official runtime (requires internet access).</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {r.installMethods.map((m) => (
                          <Button
                            key={m}
                            size="sm"
                            variant={m === 'pip' ? 'default' : 'outline'}
                            disabled={isInstalling}
                            onClick={() => install(r.id, m)}
                          >
                            Install via {m}
                          </Button>
                        ))}
                        {isInstalling && (
                          <span className="flex items-center gap-2 text-xs text-zinc-300">
                            <Spinner /> Installing via {installing.method}… (may take a few minutes)
                          </span>
                        )}
                      </div>
                      {result && !isInstalling && (
                        <div className={`mt-2 rounded-md p-2 text-xs ${result.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                          {result.success ? (
                            <>
                              <p>Installed. Restart not required — refresh the runtime list.</p>
                              {result.command && <p className="mt-1 font-mono">{result.command}</p>}
                              {result.configPath && <p className="mt-1 font-mono">{result.configPath}</p>}
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap">{result.error ?? 'Install failed.'}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {r.capabilities.map((c) => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!loading && runtimes.length === 0 && <p className="text-sm text-zinc-600">No runtimes registered.</p>}
        </div>
      </div>
    </AppShell>
  );
}
