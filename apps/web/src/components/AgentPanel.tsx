'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgentEvent, AgentStatus } from '@deepseek-harness/shared';
import { useAgentSession } from '@/lib/useAgentSession';
import { Button, StatusIndicator } from '@deepseek-harness/ui';

type MessageEvent = Extract<AgentEvent, { type: 'message' }>;
type ToolCallEvent = Extract<AgentEvent, { type: 'tool_call' }>;
type ApprovalRequestEvent = Extract<AgentEvent, { type: 'approval_request' }>;
type ErrorEvent = Extract<AgentEvent, { type: 'error' }>;

function statusFromEvents(events: AgentEvent[]): AgentStatus {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === 'status') return event.status;
  }
  return 'idle';
}

export function AgentPanel({ sessionId }: { sessionId: string }) {
  const { events, connected, sendMessage, stop, respondApproval } = useAgentSession(sessionId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const status = statusFromEvents(events);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [events]);

  const messages: MessageEvent[] = events.filter((e): e is MessageEvent => e.type === 'message');
  const toolCalls: ToolCallEvent[] = events.filter((e): e is ToolCallEvent => e.type === 'tool_call');
  const resolvedIds = new Set(
    events.filter((e) => e.type === 'approval_result').map((e) => e.requestId),
  );
  const pendingApprovals: ApprovalRequestEvent[] = events.filter(
    (e): e is ApprovalRequestEvent => e.type === 'approval_request' && !resolvedIds.has(e.id),
  );
  const lastError: ErrorEvent | undefined = [...events].reverse().find((e) => e.type === 'error') as ErrorEvent | undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-between border-b border-zinc-800 px-3">
        <span className="text-xs font-medium text-zinc-300">Agent</span>
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={`rounded-md p-2 ${m.role === 'user' ? 'bg-zinc-800' : 'bg-zinc-900 border border-zinc-800'}`}>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">{m.role}</span>
            <pre className="whitespace-pre-wrap font-sans text-zinc-200">{m.content}</pre>
          </div>
        ))}

        {toolCalls.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Tool calls</span>
            {toolCalls.map((t) => (
              <div key={t.id} className="rounded border border-zinc-800 bg-zinc-900/60 p-2 font-mono text-xs">
                <span className="text-violet-400">{t.tool}</span>
              </div>
            ))}
          </div>
        )}

        {pendingApprovals.map((a) => (
          <div key={a.id} className="rounded-md border border-amber-600/50 bg-amber-950/30 p-2">
            <div className="mb-2 text-xs text-amber-300">Approval required</div>
            <pre className="mb-2 whitespace-pre-wrap font-mono text-xs text-zinc-200">{a.action}</pre>
            <div className="flex gap-2">
              <Button size="sm" variant="success" onClick={() => respondApproval(a.id, 'allow_once')}>
                Allow once
              </Button>
              <Button size="sm" variant="secondary" onClick={() => respondApproval(a.id, 'allow_always')}>
                Allow always
              </Button>
              <Button size="sm" variant="destructive" onClick={() => respondApproval(a.id, 'deny')}>
                Deny
              </Button>
            </div>
          </div>
        ))}

        {lastError && <div className="rounded-md bg-red-950/40 p-2 text-xs text-red-300">{lastError.message}</div>}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-zinc-800 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the agent…"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
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
