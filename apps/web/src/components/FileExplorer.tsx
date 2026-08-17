'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Spinner } from '@deepseek-harness/ui';
import { Folder, FileText, FileCode2, Search, FilePlus2, FolderPlus, ArrowUp, Trash2 } from 'lucide-react';

interface Entry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

const CODE_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'go', 'rs', 'sh', 'yml', 'yaml', 'md', 'prisma', 'sql', 'toml']);

function EntryIcon({ entry }: { entry: Entry }) {
  if (entry.type === 'directory') return <Folder className="h-4 w-4 shrink-0 text-cyan-500/80" fill="currentColor" />;
  const ext = entry.name.split('.').pop() ?? '';
  if (CODE_EXT.has(ext)) return <FileCode2 className="h-4 w-4 shrink-0 text-zinc-500" />;
  return <FileText className="h-4 w-4 shrink-0 text-zinc-500" />;
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
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<'file' | 'dir' | null>(null);
  const [newName, setNewName] = useState('');

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

  async function submitCreate() {
    const name = newName.trim();
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    try {
      if (creating === 'file') await apiPost(`/projects/${projectId}/files/create-file`, { path });
      else await apiPost(`/projects/${projectId}/files/create-dir`, { path });
      await load(dir);
      if (creating === 'file') onOpenFile(path);
    } catch {
      /* ignore */
    }
    setCreating(null);
    setNewName('');
  }

  async function remove(entry: Entry) {
    if (!window.confirm(`Delete ${entry.name}?`)) return;
    await apiDelete(`/projects/${projectId}/files?path=${encodeURIComponent(entry.path)}`);
    await load(dir);
  }

  const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
  const visible = query ? entries.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())) : entries;

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 px-2">
        <span className="text-xs font-medium text-zinc-300">Explorer</span>
        <div className="flex gap-1 text-zinc-500">
          <button title="New file" onClick={() => { setCreating('file'); setNewName(''); }} className="rounded p-1 hover:bg-zinc-800 hover:text-zinc-200">
            <FilePlus2 className="h-3.5 w-3.5" />
          </button>
          <button title="New folder" onClick={() => { setCreating('dir'); setNewName(''); }} className="rounded p-1 hover:bg-zinc-800 hover:text-zinc-200">
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-zinc-800/60 p-1.5">
        <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">
          <Search className="h-3.5 w-3.5 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files…"
            className="w-full bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {dir !== '' && (
          <button className="flex w-full items-center gap-2 px-2 py-1 text-left text-zinc-500 hover:bg-zinc-800" onClick={() => void load(parent)}>
            <ArrowUp className="h-3.5 w-3.5" />
            <span className="text-xs">..</span>
          </button>
        )}

        {creating && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitCreate();
                if (e.key === 'Escape') { setCreating(null); setNewName(''); }
              }}
              onBlur={() => { setCreating(null); setNewName(''); }}
              placeholder={creating === 'file' ? 'filename.ts' : 'folder-name'}
              className="w-full rounded border border-blue-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none"
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-2 py-1 text-zinc-500">
            <Spinner /> Loading…
          </div>
        )}

        {!loading &&
          visible.map((entry) => (
            <div
              key={entry.path}
              className={`group flex cursor-pointer items-center gap-1.5 px-2 py-1 hover:bg-zinc-800 ${
                currentPath === entry.path ? 'bg-zinc-800/80' : ''
              }`}
              onClick={() => (entry.type === 'directory' ? void load(entry.path) : onOpenFile(entry.path))}
            >
              <EntryIcon entry={entry} />
              <span className="flex-1 truncate text-zinc-300">{entry.name}</span>
              <button
                className="hidden shrink-0 rounded p-0.5 text-zinc-600 group-hover:inline hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(entry);
                }}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

        {!loading && visible.length === 0 && (
          <p className="px-2 py-2 text-xs text-zinc-600">{query ? 'No matches' : 'Empty directory'}</p>
        )}
      </div>
    </div>
  );
}
