'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Button, Spinner } from '@deepseek-harness/ui';

interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  files: { path: string; status: string; staged: boolean }[];
  ahead: number;
  behind: number;
}

export function GitPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState<string>('');
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
    const d = await apiGet<{ path: string; diff: string }[]>(
      `/projects/${projectId}/git/diff?path=${encodeURIComponent(path)}&staged=${staged}`,
    );
    setDiff(d[0]?.diff ?? '');
  }

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
      setDiff('');
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
      <div className="flex-1 overflow-auto p-3">
        {diff ? (
          <pre className="font-mono text-xs text-zinc-300">{diff}</pre>
        ) : (
          <p className="text-xs text-zinc-600">Select a file to view its diff.</p>
        )}
      </div>
    </div>
  );
}
