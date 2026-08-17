'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Spinner } from '@deepseek-harness/ui';

interface Entry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export function FileExplorer({
  projectId,
  onOpenFile,
  currentPath,
}: {
  projectId: string;
  onOpenFile: (path: string) => void;
  currentPath: string | null;
}) {
  const [dir, setDir] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const data = await apiGet<Entry[]>(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
        setEntries(data);
        setDir(path);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load('');
  }, [load]);

  async function createFile() {
    const name = window.prompt('File name (relative path):');
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    await apiPost(`/projects/${projectId}/files/create-file`, { path });
    await load(dir);
  }

  async function createDir() {
    const name = window.prompt('Directory name:');
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    await apiPost(`/projects/${projectId}/files/create-dir`, { path });
    await load(dir);
  }

  async function remove(entry: Entry) {
    if (!window.confirm(`Delete ${entry.name}?`)) return;
    await apiDelete(`/projects/${projectId}/files?path=${encodeURIComponent(entry.path)}`);
    await load(dir);
  }

  const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex h-9 items-center justify-between border-b border-zinc-800 px-2">
        <span className="text-xs font-medium text-zinc-300">Explorer</span>
        <div className="flex gap-1 text-zinc-500">
          <button title="New file" onClick={createFile} className="px-1 hover:text-zinc-200">＋</button>
          <button title="New folder" onClick={createDir} className="px-1 hover:text-zinc-200">📁</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {dir !== '' && (
          <button className="block w-full px-2 py-0.5 text-left text-zinc-500 hover:bg-zinc-800" onClick={() => void load(parent)}>
            ..
          </button>
        )}
        {loading && (
          <div className="flex items-center gap-2 px-2 py-1 text-zinc-500">
            <Spinner /> Loading…
          </div>
        )}
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`group flex cursor-pointer items-center justify-between px-2 py-0.5 hover:bg-zinc-800 ${
              currentPath === entry.path ? 'bg-zinc-800' : ''
            }`}
            onClick={() => (entry.type === 'directory' ? void load(entry.path) : onOpenFile(entry.path))}
          >
            <span className="truncate">
              {entry.type === 'directory' ? '📁 ' : '📄 '}
              {entry.name}
            </span>
            <button
              className="hidden text-zinc-600 group-hover:inline hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                void remove(entry);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
