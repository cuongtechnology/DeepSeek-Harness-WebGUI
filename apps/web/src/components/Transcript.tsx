'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentEvent, PermissionDecision } from '@deepseek-harness/shared';
import { buildTranscript, formatValue, statusFromEvents } from '@/lib/transcript';
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
  Layers,
  Gauge,
} from 'lucide-react';

/** Compact token formatting: 1234 -> "1.2k", 98765 -> "98.8k". */
function formatTokens(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export interface TranscriptController {
  events: AgentEvent[];
  connected: boolean;
  sendMessage: (message: string) => void;
  stop: () => void;
  respondApproval: (requestId: string, decision: PermissionDecision) => void;
}

/**
 * Presentational transcript + composer. Owns no socket connection — it renders
 * whatever event stream the caller hands it, so both the workspace's
 * self-contained AgentPanel and the session detail page (which also needs the
 * events for its plan/tasks sidebar) render identically.
 */
export function Transcript({
  events,
  connected,
  sendMessage,
  stop,
  respondApproval,
  showHeader = true,
  readOnly = false,
  approvalResponsesSupported = false,
}: TranscriptController & {
  showHeader?: boolean;
  readOnly?: boolean;
  /** When false (default), approval cards show observed state without allow/deny buttons. */
  approvalResponsesSupported?: boolean;
}) {
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
      {showHeader && (
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
            <Bot className="h-3.5 w-3.5" /> Agent
          </span>
          <div className="flex items-center gap-2">
            <StatusIndicator status={status} />
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} title={connected ? 'connected' : 'disconnected'} />
          </div>
        </div>
      )}

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
                      {item.usage && (item.usage.input !== undefined || item.usage.output !== undefined) && (
                        <span className="ml-1 rounded bg-zinc-800 px-1 py-px font-mono normal-case tracking-normal text-zinc-400" title="Token usage reported by the runtime">
                          in {formatTokens(item.usage.input)} · out {formatTokens(item.usage.output)}
                        </span>
                      )}
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

            case 'plan_mode':
              return item.active ? (
                <div key={item.id} className="flex items-center gap-1.5 rounded-md border border-amber-600/40 bg-amber-950/30 px-2.5 py-1 text-xs text-amber-300">
                  <ListChecks className="h-3.5 w-3.5 shrink-0" /> Plan mode ON — agent plans before acting
                </div>
              ) : (
                <div key={item.id} className="flex items-center gap-1.5 rounded-md bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-500">
                  <ListChecks className="h-3.5 w-3.5 shrink-0" /> Plan mode OFF
                </div>
              );

            case 'turn':
              return item.phase === 'start' ? (
                <div key={item.id} className="flex items-center gap-2 py-0.5">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    <Layers className="h-3 w-3" /> Turn {item.index}
                  </span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
              ) : (
                <div key={item.id} className="flex items-center justify-center gap-1.5 pb-0.5 text-[10px] text-zinc-600">
                  <span>Turn {item.index} ended</span>
                  {item.reason && <span className="rounded bg-zinc-800/80 px-1 py-px text-zinc-500">{item.reason}</span>}
                </div>
              );

            case 'step':
              return item.phase === 'start' ? (
                <div key={item.id} className="flex items-center gap-1.5 pl-2 text-[10px] text-zinc-600">
                  <span className="h-3 w-px bg-zinc-700" />
                  <span className="font-mono">
                    step {item.turn}.{item.index}
                  </span>
                </div>
              ) : null;

            case 'request_header':
              return item.model || item.reason ? (
                <div key={item.id} className="flex items-center justify-end gap-1.5 text-[10px] text-zinc-600">
                  <span className="rounded bg-zinc-900/80 px-1.5 py-px font-mono">
                    {item.model ?? 'model'}
                    {item.reason ? ` · ${item.reason}` : ''}
                  </span>
                </div>
              ) : null;

            case 'compaction':
              return (
                <div key={item.id} className="rounded-md border border-sky-800/50 bg-sky-950/20 p-2 text-xs text-sky-300">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 shrink-0" />
                    {item.phase === 'start' && <span>Compacting context…</span>}
                    {item.phase === 'end' && <span>Context compacted</span>}
                    {item.phase === 'summary' && <span>Context compaction summary</span>}
                    {item.phase === 'prune' && <span>Context pruned</span>}
                    {item.shadowedTokenCount !== undefined && (
                      <span className="ml-auto rounded bg-sky-900/60 px-1 py-px font-mono text-[10px]">
                        {formatTokens(item.shadowedTokenCount)} tokens shadowed
                      </span>
                    )}
                  </div>
                  {item.summary && <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap font-sans text-sky-200/80">{item.summary}</pre>}
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
            {approvalResponsesSupported ? (
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
            ) : (
              <p className="text-[11px] text-amber-200/60">
                This runtime resolves approvals itself — the SDK wire protocol has no approval-response channel, so this
                card shows observed state only.
              </p>
            )}
          </div>
        ))}
      </div>

      {readOnly ? (
        <div className="flex h-11 shrink-0 items-center justify-center border-t border-zinc-800 text-xs text-zinc-600">
          This session has ended.
        </div>
      ) : (
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
      )}
    </div>
  );
}
