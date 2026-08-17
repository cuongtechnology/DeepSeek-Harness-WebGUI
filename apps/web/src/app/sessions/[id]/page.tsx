'use client';

import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { AgentPanel } from '@/components/AgentPanel';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <header className="flex h-11 shrink-0 items-center border-b border-zinc-800 px-3">
          <span className="font-mono text-sm text-zinc-400">{id}</span>
        </header>
        <div className="min-h-0 flex-1">
          <AgentPanel sessionId={id} />
        </div>
      </div>
    </AppShell>
  );
}
