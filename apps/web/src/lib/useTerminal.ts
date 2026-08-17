'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { API_WS_URL } from './config';

/**
 * Mount an xterm.js instance bound to one backend terminal session.
 *
 * Robustness notes: xterm 5.x throws "Cannot read properties of undefined
 * (reading 'dimensions')" if `fit()` (or the first write/scroll) runs while the
 * container is still 0×0 — the renderer never receives a resize so it has no
 * dimensions. We defer the initial fit until the box has real dimensions and
 * guard every async callback against a disposed terminal.
 */
export function useTerminal(sessionId: string | null, containerRef: React.RefObject<HTMLDivElement>) {
  const socketRef = useRef<Socket | null>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!sessionId || !el) return;

    let disposed = false;
    let fitRaf = 0;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      theme: { background: '#09090b' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    termRef.current = term;

    const socket = io(`${API_WS_URL}/terminal`, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const syncSize = () => {
      if (disposed) return;
      if (!el.clientWidth || !el.clientHeight) return;
      try {
        fit.fit();
        socket.emit('terminal:resize', { sessionId, cols: term.cols, rows: term.rows });
      } catch {
        /* transient measure failure — a later observer tick retries */
      }
    };

    const fitLoop = () => {
      if (disposed) return;
      if (!el.clientWidth || !el.clientHeight) {
        fitRaf = requestAnimationFrame(fitLoop);
        return;
      }
      syncSize();
    };
    fitRaf = requestAnimationFrame(fitLoop);

    socket.on('connect', () => socket.emit('terminal:subscribe', { sessionId }));
    socket.on('terminal:output', (payload: { sessionId: string; data: string }) => {
      if (!disposed && payload.sessionId === sessionId) term.write(payload.data);
    });

    const dataDisposable = term.onData((data) => socket.emit('terminal:input', { sessionId, data }));
    const resizeObserver = new ResizeObserver(() => syncSize());
    resizeObserver.observe(el);

    return () => {
      disposed = true;
      cancelAnimationFrame(fitRaf);
      dataDisposable.dispose();
      resizeObserver.disconnect();
      socket.disconnect();
      try {
        term.dispose();
      } catch {
        /* already disposed */
      }
      termRef.current = null;
      socketRef.current = null;
    };
  }, [sessionId, containerRef]);

  return termRef;
}
