'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@deepseek-harness/ui';
import { KeyRound, Save, Trash2, Info } from 'lucide-react';

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

interface RuntimeConfig {
  provider: string;
  model: string;
  maxTokens?: number | null;
  baseUrl?: string;
  command: string;
  args: string[];
  apiKeySet: boolean;
}

interface FormState {
  provider: string;
  model: string;
  maxTokens: string;
  baseUrl: string;
  command: string;
  args: string;
  apiKey: string;
}

const EMPTY_FORM: FormState = { provider: '', model: '', maxTokens: '', baseUrl: '', command: '', args: '', apiKey: '' };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500';

export default function AgentsSettingsPage() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<{ id: string; method: string } | null>(null);
  const [results, setResults] = useState<Record<string, InstallResult>>({});

  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [configBusy, setConfigBusy] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    apiGet<Runtime[]>('/agents')
      .then(setRuntimes)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const refreshConfig = useCallback(() => {
    apiGet<RuntimeConfig>('/agents/runtime-config')
      .then((c) => {
        setConfig(c);
        setForm({
          provider: c.provider,
          model: c.model,
          maxTokens: c.maxTokens ? String(c.maxTokens) : '',
          baseUrl: c.baseUrl ?? '',
          command: c.command,
          args: c.args.join(' '),
          apiKey: '',
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    refreshConfig();
  }, [refresh, refreshConfig]);

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

  async function saveConfig(clearKey = false) {
    setConfigBusy(true);
    setConfigMsg(null);
    try {
      const body: Record<string, unknown> = {
        provider: form.provider.trim(),
        model: form.model.trim(),
        maxTokens: form.maxTokens.trim() ? Number(form.maxTokens.trim()) : null,
        baseUrl: form.baseUrl.trim(),
        command: form.command.trim(),
        args: form.args.trim() ? form.args.trim().split(/\s+/) : [],
      };
      if (clearKey) body.apiKey = '';
      else if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();

      const updated = await apiPut<RuntimeConfig>('/agents/runtime-config', body);
      setConfig(updated);
      setForm((f) => ({ ...f, apiKey: '' }));
      setConfigMsg({ ok: true, text: 'Saved. Changes apply to new agent sessions.' });
    } catch (error) {
      setConfigMsg({ ok: false, text: error instanceof Error ? error.message : 'Failed to save.' });
    } finally {
      setConfigBusy(false);
    }
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-6">
        <h1 className="text-xl font-semibold">Agent Runtimes</h1>
        <p className="mt-1 text-sm text-zinc-500">Configured agent runtimes, their availability, and connection settings.</p>

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

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-zinc-500" /> Runtime configuration
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              How the agent runtime connects to the LLM. These override the environment defaults and apply to new sessions.
            </p>
          </CardHeader>
          <CardContent>
            {config === null ? (
              <div className="flex items-center gap-2 text-zinc-500"><Spinner /> Loading configuration…</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Provider">
                  <input className={inputCls} value={form.provider} onChange={set('provider')} placeholder="deepseek-official" />
                </Field>
                <Field label="Model">
                  <input className={inputCls} value={form.model} onChange={set('model')} placeholder="deepseek-v4-flash" />
                </Field>
                <Field label="Max tokens" hint="Leave empty for the runtime default.">
                  <input className={inputCls} value={form.maxTokens} onChange={set('maxTokens')} placeholder="unlimited" inputMode="numeric" />
                </Field>
                <Field label="Base URL" hint="Optional API endpoint override (DEEPSEEK_BASE_URL).">
                  <input className={inputCls} value={form.baseUrl} onChange={set('baseUrl')} placeholder="https://api.deepseek.com" />
                </Field>
                <Field label="Runtime command" hint="The dsh-jsonrpc-agent executable path.">
                  <input className={inputCls} value={form.command} onChange={set('command')} placeholder="dsh-jsonrpc-agent" />
                </Field>
                <Field label="Runtime arguments" hint="Extra args, split on whitespace.">
                  <input className={inputCls} value={form.args} onChange={set('args')} placeholder="--flag value" />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="API key" hint="Stored encrypted at rest; never returned by the API.">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        className={inputCls}
                        value={form.apiKey}
                        onChange={set('apiKey')}
                        placeholder={config.apiKeySet ? '•••••••••••• (set — type to replace)' : 'sk-…'}
                      />
                      {config.apiKeySet && (
                        <Button size="sm" variant="outline" disabled={configBusy} onClick={() => saveConfig(true)} title="Remove the stored API key">
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
                        </Button>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {configMsg && (
              <div className={`mt-4 rounded-md p-2 text-xs ${configMsg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                {configMsg.text}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" disabled={configBusy || config === null} onClick={() => saveConfig(false)}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save configuration
              </Button>
              {configBusy && <Spinner />}
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-zinc-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Changes apply to sessions started after saving. To re-run the runtime with updated credentials, stop any active sessions first.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
