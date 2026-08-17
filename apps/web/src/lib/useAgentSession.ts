'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_WS_URL } from './config';
import { apiGet } from './api';
import type { AgentEvent, PermissionDecision } from '@deepseek-harness/shared';

export interface AgentSessionSocket {
  events: AgentEvent[];
  connected: boolean;
  sendMessage: (message: string) => void;
  stop: () => void;
  respondApproval: (requestId: string, decision: PermissionDecision) => void;
}

interface EventRecord {
  type: string;
  payload: AgentEvent;
}

/**
 * Live socket connection to one agent session, optionally seeded with the
 * session's persisted event history (for re-opening an existing session).
 *
 * Ordering + dedup: when replaying history, live events are buffered until the
 * history fetch resolves, then flushed after it so the transcript stays
 * chronological and no event (persisted + broadcast) appears twice.
 */
export function useAgentSession(sessionId: string | null, opts: { replay?: boolean } = {}): AgentSessionSocket {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let historyLoaded = !opts.replay;
    const seen = new Set<string>();
    const buffered: AgentEvent[] = [];

    const push = (event: AgentEvent) => {
      const key = JSON.stringify(event);
      if (seen.has(key)) return;
      seen.add(key);
      setEvents((prev) => [...prev, event]);
    };

    const flush = () => {
      historyLoaded = true;
      for (const event of buffered) push(event);
    };

    setEvents([]);

    const socket = io(`${API_WS_URL}/agent`, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('agent:subscribe', { sessionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('agent:event', (payload: { sessionId: string; event: AgentEvent }) => {
      if (historyLoaded) push(payload.event);
      else buffered.push(payload.event);
    });

    if (opts.replay) {
      apiGet<EventRecord[]>(`/sessions/${sessionId}/events`)
        .then((records) => {
          if (cancelled) return;
          for (const record of records) push(record.payload);
          flush();
        })
        .catch(() => {
          if (!cancelled) flush();
        });
    }

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return {
    events,
    connected,
    sendMessage: (message) => socketRef.current?.emit('agent:input', { sessionId, message }),
    stop: () => socketRef.current?.emit('agent:stop', { sessionId }),
    respondApproval: (requestId, decision) =>
      socketRef.current?.emit('approval:respond', { requestId, decision }),
  };
}
