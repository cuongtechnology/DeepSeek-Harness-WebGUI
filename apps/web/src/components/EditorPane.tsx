'use client';

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { apiGet, apiPut } from '@/lib/api';
import { Spinner } from '@deepseek-harness/ui';

export interface OpenFile {
  path: string;
  content: string;
  dirty: boolean;
}

export function EditorPane({
  projectId,
  files,
  activePath,
  onClose,
  onSave,
}: {
  projectId: string;
  files: OpenFile[];
  activePath: string | null;
  onClose: (path: string) => void;
  onSave: (path: string, content: string) => void;
}) {
  const active = files.find((f) => f.path === activePath) ?? null;
  const [content, setContent] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      setContent(null);
      return;
    }
    if (loadedRef.current !== active.path || !active.content) {
      void apiGet<{ content: string }>(`/projects/${projectId}/files/read?path=${encodeURIComponent(active.path)}`)
        .then((r) => {
          setContent(r.content);
          loadedRef.current = active.path;
        })
        .catch(() => setContent(''));
    }
  }, [active, projectId]);

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center gap-0 border-b border-zinc-800">
        {files.map((f) => (
          <div
            key={f.path}
            className={`flex items-center gap-2 border-r border-zinc-800 px-3 py-1.5 text-xs ${
              f.path === activePath ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500'
            }`}
          >
            <span className="cursor-pointer" onClick={() => onSave(active.path, content ?? '')}>
              {f.path.split('/').pop()}
            </span>
            {f.dirty && <span className="text-amber-400">●</span>}
            <button className="text-zinc-600 hover:text-zinc-200" onClick={() => onClose(f.path)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          path={active.path}
          value={content ?? ''}
          language={languageFor(active.path)}
          onChange={(value) => setContent(value ?? '')}
          options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
        />
      </div>
      <div className="flex h-8 items-center justify-end gap-2 border-t border-zinc-800 px-2">
        <button
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
          onClick={() => {
            onSave(active.path, content ?? '');
            loadedRef.current = null;
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function languageFor(path: string): string {
  const ext = path.split('.').pop() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown', css: 'css', html: 'html', py: 'python',
    go: 'go', rs: 'rust', sh: 'shell', yml: 'yaml', yaml: 'yaml', prisma: 'prisma',
  };
  return map[ext] ?? 'plaintext';
}
