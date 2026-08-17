'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { API_WS_URL } from './config';

export function useTerminal(sessionId: string | null, containerRef: React.RefObject<HTMLDivElement>) {
  const socketRef = useRef<Socket | null>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      theme: { background: '#09090b' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    const socket = io(`${API_WS_URL}/terminal`, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('terminal:subscribe', { sessionId }));
    socket.on('terminal:output', (payload: { sessionId: string; data: string }) => {
      if (payload.sessionId === sessionId) term.write(payload.data);
    });

    const dataDisposable = term.onData((data) => socket.emit('terminal:input', { sessionId, data }));
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      socket.emit('terminal:resize', { sessionId, cols: term.cols, rows: term.rows });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      socket.disconnect();
      term.dispose();
      termRef.current = null;
      socketRef.current = null;
    };
  }, [sessionId, containerRef]);

  return termRef;
}
