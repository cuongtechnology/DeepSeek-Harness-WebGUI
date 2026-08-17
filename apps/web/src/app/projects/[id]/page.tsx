'use client';

import { useCallback, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { FileExplorer } from '@/components/FileExplorer';
import { EditorPane, type OpenFile } from '@/components/EditorPane';
import { AgentPanel } from '@/components/AgentPanel';
import { TerminalPanel } from '@/components/TerminalPanel';
import { GitPanel } from '@/components/GitPanel';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@deepseek-harness/ui';

function useResize(initial: number) {
  const [size, setSize] = useState(initial);
  const dragging = useRef(false);
  const onMouseDown = () => (dragging.current = true);
  const onMouseMove = useCallback(
    (dx: number, dir: 1 | -1) => {
      if (!dragging.current) return;
      setSize((s) => Math.max(120, s + dx * dir));
    },
    [],
  );
  const onMouseUp = () => (dragging.current = false);
  return { size, onMouseDown, onMouseMove, onMouseUp };
}

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'git'>('git');

  const explorer = useResize(240);
  const agent = useResize(340);
  const bottom = useResize(220);

  function openFile(path: string) {
    setFiles((prev) => {
      if (prev.some((f) => f.path === path)) return prev;
      return [...prev, { path, content: '', dirty: false }];
    });
    setActivePath(path);
  }

  function closeFile(path: string) {
    setFiles((prev) => prev.filter((f) => f.path !== path));
    if (activePath === path) setActivePath(null);
  }

  async function saveFile(path: string, content: string) {
    await apiPost(`/projects/${projectId}/files/write`, { path, content });
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, dirty: false } : f)));
  }

  async function startAgent() {
    const session = await apiPost<{ id: string }>(`/projects/${projectId}/sessions`, {});
    setSessionId(session.id);
  }

  async function newTerminal() {
    const term = await apiPost<{ id: string }>(`/projects/${projectId}/terminal`, {});
    setTerminalId(term.id);
    setBottomTab('terminal');
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
          <span className="text-sm font-medium">Workspace</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void startAgent()}>Start agent</Button>
            <Button size="sm" variant="secondary" onClick={() => void newTerminal()}>New terminal</Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Explorer */}
          <div style={{ width: explorer.size }} className="shrink-0 border-r border-zinc-800">
            <FileExplorer projectId={projectId} onOpenFile={openFile} currentPath={activePath} />
          </div>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-zinc-900 hover:bg-blue-600"
            onMouseDown={explorer.onMouseDown}
            onMouseUp={explorer.onMouseUp}
            onMouseLeave={explorer.onMouseUp}
            onMouseMove={(e) => explorer.onMouseMove(e.movementX, 1)}
          />

          {/* Editor */}
          <div className="min-w-0 flex-1">
            <EditorPane projectId={projectId} files={files} activePath={activePath} onClose={closeFile} onSave={(p, c) => void saveFile(p, c)} />
          </div>

          {/* Agent */}
          <div
            className="w-1 shrink-0 cursor-col-resize bg-zinc-900 hover:bg-blue-600"
            onMouseDown={agent.onMouseDown}
            onMouseUp={agent.onMouseUp}
            onMouseLeave={agent.onMouseUp}
            onMouseMove={(e) => agent.onMouseMove(e.movementX, -1)}
          />
          <div style={{ width: agent.size }} className="shrink-0 border-l border-zinc-800">
            {sessionId ? <AgentPanel sessionId={sessionId} /> : <div className="p-3 text-sm text-zinc-600">Start an agent to chat.</div>}
          </div>
        </div>

        {/* Bottom panel */}
        <div
          className="h-1 shrink-0 cursor-row-resize bg-zinc-900 hover:bg-blue-600"
          onMouseDown={bottom.onMouseDown}
          onMouseUp={bottom.onMouseUp}
          onMouseLeave={bottom.onMouseUp}
          onMouseMove={(e) => bottom.onMouseMove(e.movementY, -1)}
        />
        <div style={{ height: bottom.size }} className="shrink-0 border-t border-zinc-800">
          <div className="flex h-8 items-center gap-1 border-b border-zinc-800 px-2 text-xs">
            {(['terminal', 'git'] as const).map((tab) => (
              <button
                key={tab}
                className={`rounded px-2 py-0.5 capitalize ${bottomTab === tab ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`}
                onClick={() => setBottomTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="h-[calc(100%-2rem)]">
            {bottomTab === 'terminal' ? <TerminalPanel sessionId={terminalId} /> : <GitPanel projectId={projectId} />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
