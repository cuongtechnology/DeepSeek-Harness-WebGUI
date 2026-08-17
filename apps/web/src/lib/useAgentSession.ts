'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_WS_URL } from './config';
import type { AgentEvent, PermissionDecision } from '@deepseek-harness/shared';

export interface AgentSessionSocket {
  events: AgentEvent[];
  connected: boolean;
  sendMessage: (message: string) => void;
  stop: () => void;
  respondApproval: (requestId: string, decision: PermissionDecision) => void;
}

export function useAgentSession(sessionId: string | null): AgentSessionSocket {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const socket = io(`${API_WS_URL}/agent`, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('agent:subscribe', { sessionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('agent:event', (payload: { sessionId: string; event: AgentEvent }) => {
      setEvents((prev) => [...prev, payload.event]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
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
