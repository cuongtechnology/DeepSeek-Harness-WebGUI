'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { FileExplorer } from '@/components/FileExplorer';
import { EditorPane } from '@/components/EditorPane';
import { AgentPanel } from '@/components/AgentPanel';
import { GitPanel } from '@/components/GitPanel';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@deepseek-harness/ui';
import { ChevronLeft, Bot, TerminalSquare, GitBranch } from 'lucide-react';
import dynamic from 'next/dynamic';

const TerminalPanel = dynamic(() => import('@/components/TerminalPanel').then((m) => m.TerminalPanel), { ssr: false });

function useResize(initial: number) {
  const [size, setSize] = useState(initial);
  const dragging = useRef(false);
  const onMouseDown = () => (dragging.current = true);
  const onMouseMove = useCallback((dx: number, dir: 1 | -1) => {
    if (!dragging.current) return;
    setSize((s) => Math.max(120, s + dx * dir));
  }, []);
  const onMouseUp = () => (dragging.current = false);
  return { size, onMouseDown, onMouseMove, onMouseUp };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'git'>('git');

  const explorer = useResize(240);
  const agent = useResize(360);
  const bottom = useResize(220);

  useEffect(() => {
    apiGet<Project>(`/projects/${projectId}`).then(setProject).catch(() => undefined);
  }, [projectId]);

  function openFile(path: string) {
    setFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActivePath(path);
  }

  function closeFile(path: string) {
    setFiles((prev) => prev.filter((p) => p !== path));
    if (activePath === path) setActivePath(null);
  }

  async function saveFile(path: string, content: string): Promise<void> {
    await apiPost(`/projects/${projectId}/files/write`, { path, content });
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
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/projects" className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" title="Back to projects">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="truncate text-sm font-medium text-zinc-100">{project?.name ?? 'Workspace'}</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">{projectId.slice(0, 8)}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => void startAgent()}>
              <Bot className="mr-1.5 h-3.5 w-3.5" /> {sessionId ? 'New session' : 'Start agent'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void newTerminal()}>
              <TerminalSquare className="mr-1.5 h-3.5 w-3.5" /> Terminal
            </Button>
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
            <EditorPane
              projectId={projectId}
              files={files}
              activePath={activePath}
              onSelect={setActivePath}
              onClose={closeFile}
              onSave={(p, c) => saveFile(p, c)}
            />
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
            {sessionId ? (
              <AgentPanel sessionId={sessionId} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-zinc-600">
                <Bot className="h-8 w-8" />
                <p className="text-sm">Start an agent to chat and drive changes in this workspace.</p>
                <Button size="sm" onClick={() => void startAgent()}>
                  Start agent
                </Button>
              </div>
            )}
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
            {(
              [
                { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
                { id: 'git', label: 'Git', icon: GitBranch },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center gap-1.5 rounded px-2 py-0.5 ${
                  bottomTab === tab.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                onClick={() => setBottomTab(tab.id)}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="h-[calc(100%-2rem)]">
            {bottomTab === 'terminal' ? (
              terminalId ? (
                <TerminalPanel sessionId={terminalId} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
                  <TerminalSquare className="h-6 w-6" />
                  <Button size="sm" variant="secondary" onClick={() => void newTerminal()}>
                    New terminal
                  </Button>
                </div>
              )
            ) : (
              <GitPanel projectId={projectId} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
