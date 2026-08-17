'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, Button, Spinner } from '@deepseek-harness/ui';
import { languageFor } from '@/lib/language';
import {
  FileDiff,
  Binary,
  GitCommit,
  GitBranch,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';

const DiffEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.DiffEditor), { ssr: false });

interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  files: { path: string; status: string; staged: boolean }[];
  ahead: number;
  behind: number;
}

interface GitDiffPair {
  path: string;
  original: string;
  modified: string;
  binary: boolean;
  kind: 'added' | 'deleted' | 'modified';
}

interface GitLogEntry {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface GitBranchInfo {
  name: string;
  current: boolean;
}

const KIND_STYLE: Record<string, string> = {
  added: 'bg-emerald-900/40 text-emerald-300',
  deleted: 'bg-red-900/40 text-red-300',
  modified: 'bg-zinc-800 text-zinc-300',
};

type Tab = 'changes' | 'log' | 'branches';

const TABS: { id: Tab; label: string }[] = [
  { id: 'changes', label: 'Changes' },
  { id: 'log', label: 'Log' },
  { id: 'branches', label: 'Branches' },
];

export function GitPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState<GitDiffPair | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('changes');
  const [log, setLog] = useState<GitLogEntry[] | null>(null);
  const [branches, setBranches] = useState<GitBranchInfo[] | null>(null);

  const load = useCallback(async () => {
    const s = await apiGet<GitStatus>(`/projects/${projectId}/git/status`);
    setStatus(s);
  }, [projectId]);

  const loadLog = useCallback(async () => {
    const l = await apiGet<GitLogEntry[]>(`/projects/${projectId}/git/log?count=100`);
    setLog(l);
  }, [projectId]);

  const loadBranches = useCallback(async () => {
    const b = await apiGet<GitBranchInfo[]>(`/projects/${projectId}/git/branches`);
    setBranches(b);
  }, [projectId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (tab === 'log' && log === null) loadLog().catch(() => setLog([]));
    if (tab === 'branches' && branches === null) loadBranches().catch(() => setBranches([]));
  }, [tab, log, branches, loadLog, loadBranches]);

  async function showDiff(path: string, staged: boolean) {
    const d = await apiGet<GitDiffPair | null>(
      `/projects/${projectId}/git/diff-pair?path=${encodeURIComponent(path)}&staged=${staged}`,
    );
    setDiff(d);
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      if (log !== null) await loadLog().catch(() => undefined);
      if (branches !== null) await loadBranches().catch(() => undefined);
      setDiff(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return <div className="flex h-full items-center justify-center text-zinc-600"><Spinner /></div>;
  }
  if (!status.isRepo) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-600">Not a git repository</div>;
  }

  const changed = status.files;
  const iconBtn = 'rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40';

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="shrink-0 border-b border-red-900/50 bg-red-950/40 px-3 py-1.5 text-xs text-red-300">{error}</div>
      )}

      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-zinc-800 px-2 text-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`rounded px-2 py-0.5 ${
              tab === t.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-zinc-500">{status.branch}</span>
          <span className="text-[11px] text-zinc-600">↑{status.ahead} ↓{status.behind}</span>
          <button className={iconBtn} title="Refresh" disabled={busy} onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button className={iconBtn} title="Pull" disabled={busy} onClick={() => run(() => apiPost(`/projects/${projectId}/git/pull`))}>
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </button>
          <button className={iconBtn} title="Push" disabled={busy} onClick={() => run(() => apiPost(`/projects/${projectId}/git/push`))}>
            <ArrowUpFromLine className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'changes' && (
          <div className="flex h-full">
            <div className="w-72 shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
              {changed.length === 0 && <p className="text-xs text-zinc-600">Working tree clean</p>}
              {changed.map((f) => (
                <div key={f.path} className="flex items-center justify-between py-1 font-mono text-xs">
                  <button className="truncate text-zinc-300 hover:text-blue-400" onClick={() => void showDiff(f.path, f.staged)}>
                    <span className="mr-1 text-zinc-500">{f.status}</span>
                    {f.path}
                  </button>
                  <button
                    className="text-zinc-600 hover:text-zinc-200"
                    onClick={() => run(() => apiPost(`/projects/${projectId}/git/${f.staged ? 'unstage' : 'stage'}`, { paths: [f.path] }))}
                  >
                    {f.staged ? '−' : '+'}
                  </button>
                </div>
              ))}
              {changed.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Commit message"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs outline-none"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!message.trim() || busy}
                    onClick={() =>
                      run(async () => {
                        await apiPost(`/projects/${projectId}/git/commit`, { message });
                        setMessage('');
                      })
                    }
                  >
                    Commit staged
                  </Button>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {!diff ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
                  <FileDiff className="h-8 w-8" />
                  <p className="text-xs">Select a file to view its diff.</p>
                </div>
              ) : (
                <>
                  <div className="flex h-8 shrink-0 items-center gap-2 border-b border-zinc-800 px-3 text-xs">
                    <span className="truncate font-mono text-zinc-300">{diff.path}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${KIND_STYLE[diff.kind] ?? 'bg-zinc-800 text-zinc-400'}`}>{diff.kind}</span>
                  </div>
                  <div className="min-h-0 flex-1">
                    {diff.binary ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
                        <Binary className="h-8 w-8" />
                        <p className="text-xs">Binary file — changes not shown as text.</p>
                      </div>
                    ) : (
                      <DiffEditor
                        height="100%"
                        theme="vs-dark"
                        original={diff.original}
                        modified={diff.modified}
                        language={languageFor(diff.path)}
                        options={{
                          readOnly: true,
                          fontSize: 13,
                          minimap: { enabled: false },
                          automaticLayout: true,
                          scrollBeyondLastLine: false,
                          renderSideBySide: true,
                        }}
                        loading={<div className="flex h-full items-center justify-center text-zinc-600"><Spinner /></div>}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'log' && (
          <div className="h-full overflow-y-auto">
            {log === null ? (
              <div className="flex h-full items-center justify-center text-zinc-600"><Spinner /></div>
            ) : log.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
                <GitCommit className="h-8 w-8" />
                <p className="text-xs">No commits yet.</p>
              </div>
            ) : (
              log.map((c) => (
                <div key={c.hash} className="flex items-start gap-2.5 border-b border-zinc-800/50 px-3 py-2">
                  <GitCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-200">{c.message.split('\n')[0]}</p>
                    <p className="truncate text-[10px] text-zinc-500">
                      {c.author} · {new Date(c.date).toLocaleString()}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-600">{c.hash.slice(0, 7)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'branches' && (
          <div className="h-full overflow-y-auto">
            {branches === null ? (
              <div className="flex h-full items-center justify-center text-zinc-600"><Spinner /></div>
            ) : branches.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
                <GitBranch className="h-8 w-8" />
                <p className="text-xs">No branches found.</p>
              </div>
            ) : (
              branches.map((b) => (
                <div key={b.name} className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <GitBranch className={`h-3.5 w-3.5 shrink-0 ${b.current ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <span className={`text-xs ${b.current ? 'font-medium text-emerald-300' : 'text-zinc-300'}`}>{b.name}</span>
                    {b.current && <Badge variant="success">current</Badge>}
                  </div>
                  {!b.current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => apiPost(`/projects/${projectId}/git/checkout`, { branch: b.name }))}
                    >
                      Checkout
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
