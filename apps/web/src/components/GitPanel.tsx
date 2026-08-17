'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { apiGet, apiPost } from '@/lib/api';
import { Button, Spinner } from '@deepseek-harness/ui';
import { languageFor } from '@/lib/language';
import { FileDiff, Binary } from 'lucide-react';

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

const KIND_STYLE: Record<string, string> = {
  added: 'bg-emerald-900/40 text-emerald-300',
  deleted: 'bg-red-900/40 text-red-300',
  modified: 'bg-zinc-800 text-zinc-300',
};

export function GitPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState<GitDiffPair | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await apiGet<GitStatus>(`/projects/${projectId}/git/status`);
    setStatus(s);
  }, [projectId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function showDiff(path: string, staged: boolean) {
    const d = await apiGet<GitDiffPair | null>(
      `/projects/${projectId}/git/diff-pair?path=${encodeURIComponent(path)}&staged=${staged}`,
    );
    setDiff(d);
  }

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
      setDiff(null);
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

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs text-zinc-400">{status.branch}</span>
          <span className="text-xs text-zinc-500">
            ↑{status.ahead} ↓{status.behind}
          </span>
        </div>
        {changed.length === 0 && <p className="text-xs text-zinc-600">Working tree clean</p>}
        {changed.map((f) => (
          <div key={f.path} className="flex items-center justify-between py-1 font-mono text-xs">
            <button className="truncate text-zinc-300 hover:text-blue-400" onClick={() => void showDiff(f.path, f.staged)}>
              <span className="mr-1 text-zinc-500">{f.status}</span>
              {f.path}
            </button>
            <button
              className="text-zinc-600 hover:text-zinc-200"
              onClick={() => action(() => apiPost(`/projects/${projectId}/git/${f.staged ? 'unstage' : 'stage'}`, { paths: [f.path] }))}
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
                action(async () => {
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
  );
}
