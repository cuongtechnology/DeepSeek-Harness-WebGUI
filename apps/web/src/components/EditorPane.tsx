'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { apiGet } from '@/lib/api';
import { languageFor } from '@/lib/language';
import { Spinner } from '@deepseek-harness/ui';
import { FileCode2, X } from 'lucide-react';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface FileState {
  value: string;
  saved: string;
}

export function EditorPane({
  projectId,
  files,
  activePath,
  onSelect,
  onClose,
  onSave,
}: {
  projectId: string;
  files: string[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onSave: (path: string, content: string) => Promise<void> | void;
}) {
  const [contents, setContents] = useState<Record<string, FileState>>({});
  const loadedRef = useRef<Set<string>>(new Set());

  // Fetch newly opened files, and drop state for closed ones.
  useEffect(() => {
    const fileSet = new Set(files);
    for (const p of [...loadedRef.current]) {
      if (!fileSet.has(p)) loadedRef.current.delete(p);
    }
    setContents((prev) => {
      const next: Record<string, FileState> = {};
      for (const p of Object.keys(prev)) {
        if (fileSet.has(p)) next[p] = prev[p];
      }
      return next;
    });

    for (const path of files) {
      if (loadedRef.current.has(path)) continue;
      loadedRef.current.add(path);
      void apiGet<{ content: string }>(`/projects/${projectId}/files/read?path=${encodeURIComponent(path)}`)
        .then((r) => setContents((p) => ({ ...p, [path]: { value: r.content, saved: r.content } })))
        .catch(() => setContents((p) => ({ ...p, [path]: { value: '', saved: '' } })));
    }
  }, [files, projectId]);

  const active = activePath && files.includes(activePath) ? activePath : null;
  const entry = active ? contents[active] : undefined;
  const dirty = active && entry ? entry.value !== entry.saved : false;

  // Ctrl/Cmd+S to save.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (active && entry) void onSave(active, entry.value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, entry, onSave]);

  if (!active || !entry) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
        <FileCode2 className="h-8 w-8" />
        <p className="text-sm">Select a file to edit</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-stretch overflow-x-auto border-b border-zinc-800 bg-zinc-900/40">
        {files.map((f) => {
          const isActive = f === active;
          const isDirty = contents[f] ? contents[f].value !== contents[f].saved : false;
          return (
            <div
              key={f}
              onClick={() => onSelect(f)}
              className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-zinc-800 px-3 text-xs ${
                isActive ? 'bg-zinc-950 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
              }`}
            >
              <span className="max-w-[140px] truncate">{f.split('/').pop()}</span>
              {isDirty ? <span className="text-amber-400">●</span> : <span className="w-1.5" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(f);
                }}
                className="rounded p-0.5 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-200"
                title="Close"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {entry ? (
          <Editor
            height="100%"
            theme="vs-dark"
            path={active}
            value={entry.value}
            language={languageFor(active)}
            onChange={(value) =>
              setContents((p) => ({ ...p, [active]: { value: value ?? '', saved: p[active]?.saved ?? '' } }))
            }
            options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false }}
            loading={<div className="flex h-full items-center justify-center text-zinc-600"><Spinner /></div>}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <Spinner />
          </div>
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-zinc-800 px-2 text-xs text-zinc-500">
        <span className="font-mono">{active}</span>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-amber-400">Unsaved changes</span>}
          <button
            onClick={() => void onSave(active, entry.value)}
            disabled={!dirty}
            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
