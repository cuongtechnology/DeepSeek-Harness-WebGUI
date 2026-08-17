'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentEvent, AgentStatus, PermissionDecision } from '@deepseek-harness/shared';
import { useAgentSession } from '@/lib/useAgentSession';
import { Button, StatusIndicator } from '@deepseek-harness/ui';
import {
  Wrench,
  Terminal,
  FileText,
  ListChecks,
  GitBranch,
  AlertTriangle,
  ShieldAlert,
  Bot,
  User,
  Loader2,
} from 'lucide-react';

type Item =
  | { kind: 'message'; id: string; role: string; content: string }
  | { kind: 'tool'; id: string; tool: string; input: unknown; output?: unknown; isError?: boolean }
  | { kind: 'command'; id: string; command: string }
  | { kind: 'file'; id: string; path: string; change: string }
  | { kind: 'task'; id: string; title: string; status: string }
  | { kind: 'subagent'; id: string; text: string }
  | { kind: 'error'; id: string; message: string };

function statusFromEvents(events: AgentEvent[]): AgentStatus {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'status') return e.status;
  }
  return 'idle';
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildTranscript(events: AgentEvent[]): { items: Item[]; streaming: string } {
  const items: Item[] = [];
  const toolIndex = new Map<string, number>();
  let streaming = '';

  for (const e of events) {
    switch (e.type) {
      case 'message':
        if (e.role === 'assistant') streaming = '';
        items.push({ kind: 'message', id: e.id, role: e.role, content: e.content });
        break;
      case 'message_delta':
        streaming += e.content;
        break;
      case 'tool_call': {
        toolIndex.set(e.id, items.length);
        items.push({ kind: 'tool', id: e.id, tool: e.tool, input: e.input });
        break;
      }
      case 'tool_result': {
        const idx = toolIndex.get(e.toolCallId);
        if (idx !== undefined) {
          const item = items[idx] as Extract<Item, { kind: 'tool' }>;
          item.output = e.output;
          item.isError = e.isError;
        }
        break;
      }
      case 'command':
        items.push({ kind: 'command', id: e.command, command: e.command });
        break;
      case 'file_changed':
        items.push({ kind: 'file', id: `${e.path}:${e.change}`, path: e.path, change: e.change });
        break;
      case 'task_update':
        items.push({ kind: 'task', id: e.task.id, title: e.task.title, status: e.task.status });
        break;
      case 'subagent':
        items.push({
          kind: 'subagent',
          id: `${e.childSessionId}:${e.action}`,
          text:
            e.action === 'started'
              ? `Subagent spawned (${e.childSessionId.slice(0, 8)}…)`
              : `Subagent finished (${e.childSessionId.slice(0, 8)}…)${e.status ? ` · ${e.status}` : ''}`,
        });
        break;
      case 'error':
        items.push({ kind: 'error', id: e.message, message: e.message });
        break;
    }
  }

  return { items, streaming };
}

export function AgentPanel({ sessionId }: { sessionId: string }) {
  const { events, connected, sendMessage, stop, respondApproval } = useAgentSession(sessionId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const status = statusFromEvents(events);
  const { items, streaming } = useMemo(() => buildTranscript(events), [events]);

  const resolvedIds = useMemo(
    () => new Set(events.filter((e) => e.type === 'approval_result').map((e) => e.requestId)),
    [events],
  );
  const pendingApprovals = useMemo(
    () => events.filter((e): e is Extract<AgentEvent, { type: 'approval_request' }> => e.type === 'approval_request' && !resolvedIds.has(e.id)),
    [events, resolvedIds],
  );

  const thinking = status === 'thinking' || status === 'running';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items, streaming, pendingApprovals.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
          <Bot className="h-3.5 w-3.5" /> Agent
        </span>
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} title={connected ? 'connected' : 'disconnected'} />
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {items.length === 0 && !streaming && !thinking && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
            <Bot className="h-8 w-8" />
            <p className="text-sm">Send a message to start the agent.</p>
          </div>
        )}

        {items.map((item) => {
          switch (item.kind) {
            case 'message':
              return item.role === 'user' ? (
                <div key={item.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-br-sm bg-blue-600/20 px-3 py-2">
                    <span className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-blue-400">
                      <User className="h-3 w-3" /> You
                    </span>
                    <pre className="whitespace-pre-wrap font-sans text-zinc-100">{item.content}</pre>
                  </div>
                </div>
              ) : (
                <div key={item.id} className="flex justify-start">
                  <div className="max-w-[90%] rounded-lg rounded-bl-sm border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                    <span className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                      <Bot className="h-3 w-3" /> Assistant
                    </span>
                    <pre className="whitespace-pre-wrap font-sans text-zinc-200">{item.content}</pre>
                  </div>
                </div>
              );

            case 'tool':
              return (
                <div key={item.id} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Wrench className="h-3.5 w-3.5 text-violet-400" />
                    <span className="font-mono font-medium text-violet-300">{item.tool}</span>
                    {item.output === undefined ? (
                      <span className="flex items-center gap-1 text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" /> running</span>
                    ) : item.isError ? (
                      <span className="text-red-400">failed</span>
                    ) : (
                      <span className="text-emerald-400">done</span>
                    )}
                  </div>
                  {item.input !== undefined && item.input !== null && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300">input</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-300">{formatValue(item.input)}</pre>
                    </details>
                  )}
                  {item.output !== undefined && (
                    <details className="mt-1.5" open={item.isError}>
                      <summary className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300">output</summary>
                      <pre className={`mt-1 max-h-48 overflow-auto rounded bg-zinc-950 p-2 text-xs ${item.isError ? 'text-red-300' : 'text-zinc-300'}`}>
                        {formatValue(item.output).slice(0, 4000)}
                      </pre>
                    </details>
                  )}
                </div>
              );

            case 'command':
              return (
                <div key={item.id} className="flex items-center gap-1.5 rounded-md bg-zinc-900/70 px-2.5 py-1.5 font-mono text-xs">
                  <Terminal className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="text-emerald-400">$</span>
                  <span className="text-zinc-300">{item.command}</span>
                </div>
              );

            case 'file':
              return (
                <div key={item.id} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono text-zinc-300">{item.path}</span>
                  <span className={`rounded px-1 py-0.5 text-[10px] ${item.change === 'delete' ? 'bg-red-900/40 text-red-300' : item.change === 'create' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                    {item.change}
                  </span>
                </div>
              );

            case 'task':
              return (
                <div key={item.id} className="flex items-center gap-1.5 text-xs">
                  <ListChecks className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className={item.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}>{item.title}</span>
                  <span className="text-[10px] text-zinc-600">{item.status}</span>
                </div>
              );

            case 'subagent':
              return (
                <div key={item.id} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <GitBranch className="h-3.5 w-3.5 shrink-0" />
                  {item.text}
                </div>
              );

            case 'error':
              return (
                <div key={item.id} className="flex items-start gap-1.5 rounded-md bg-red-950/40 p-2 text-xs text-red-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{item.message}</span>
                </div>
              );
          }
        })}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-lg rounded-bl-sm border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <span className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                <Bot className="h-3 w-3" /> Assistant
              </span>
              <pre className="whitespace-pre-wrap font-sans text-zinc-200">
                {streaming}
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-zinc-400 align-text-bottom" />
              </pre>
            </div>
          </div>
        )}

        {thinking && !streaming && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        )}

        {pendingApprovals.map((a) => (
          <div key={a.id} className="rounded-md border border-amber-600/50 bg-amber-950/30 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" /> Approval required · {a.category}
            </div>
            <pre className="mb-2 whitespace-pre-wrap rounded bg-zinc-950/60 p-2 font-mono text-xs text-zinc-200">{a.action}</pre>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" onClick={() => respondApproval(a.id, 'allow_once' as PermissionDecision)}>
                Allow once
              </Button>
              <Button size="sm" variant="secondary" onClick={() => respondApproval(a.id, 'allow_always' as PermissionDecision)}>
                Allow always
              </Button>
              <Button size="sm" variant="destructive" onClick={() => respondApproval(a.id, 'deny' as PermissionDecision)}>
                Deny
              </Button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-zinc-800 p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          placeholder="Message the agent… (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="max-h-32 min-h-[2.25rem] flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <Button type="submit" size="sm" disabled={!input.trim()}>
          Send
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={() => stop()}>
          Stop
        </Button>
      </form>
    </div>
  );
}
