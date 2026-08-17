'use client';

import { useRef } from 'react';
import { useTerminal } from '@/lib/useTerminal';

export function TerminalPanel({ sessionId }: { sessionId: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(sessionId, containerRef);

  return <div ref={containerRef} className="h-full w-full bg-zinc-950 p-1" />;
}
