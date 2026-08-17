import * as pty from 'node-pty';
import { NotFoundError } from '@deepseek-harness/shared';

export interface TerminalCallbacks {
  onData: (data: string) => void;
  onExit: (exitCode: number | null) => void;
}

export interface PtySessionInfo {
  id: string;
  cwd: string;
  cols: number;
  rows: number;
  pid: number;
}

interface ActiveSession {
  ptyProcess: pty.IPty;
  cwd: string;
  callbacks: TerminalCallbacks;
  exited: boolean;
}

function detectShell(): string {
  const shell = process.env.SHELL;
  if (shell && shell.length > 0) return shell;
  return process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
}

/**
 * Manages PTY sessions bound to project workspaces. Each session owns a real
 * pseudo-terminal spawned via node-pty; the API layer relays WebSocket input
 * to {@link write} and terminal output to the registered callbacks.
 *
 * The process is always a child of the API process but runs with the working
 * directory pinned to the project workspace. Command execution is therefore
 * subject to the same security boundary as any other workspace operation.
 */
export class TerminalManager {
  private readonly sessions = new Map<string, ActiveSession>();

  create(
    id: string,
    cwd: string,
    cols: number,
    rows: number,
    callbacks: TerminalCallbacks,
  ): PtySessionInfo {
    if (this.sessions.has(id)) {
      return this.info(id);
    }

    const shell = detectShell();
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: Math.max(2, Math.floor(cols)),
      rows: Math.max(2, Math.floor(rows)),
      cwd,
      env: { ...(process.env as Record<string, string>), TERM: 'xterm-256color' },
    });

    const session: ActiveSession = { ptyProcess, cwd, callbacks, exited: false };

    ptyProcess.onData((data) => callbacks.onData(data));
    ptyProcess.onExit(({ exitCode }) => {
      session.exited = true;
      callbacks.onExit(exitCode);
    });

    this.sessions.set(id, session);
    return this.info(id);
  }

  write(id: string, data: string): void {
    const session = this.requireSession(id);
    if (!session.exited) {
      session.ptyProcess.write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.requireSession(id);
    session.ptyProcess.resize(Math.max(2, Math.floor(cols)), Math.max(2, Math.floor(rows)));
  }

  kill(id: string): void {
    const session = this.requireSession(id);
    if (!session.exited) {
      session.ptyProcess.kill();
    }
    this.sessions.delete(id);
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  info(id: string): PtySessionInfo {
    const session = this.requireSession(id);
    return {
      id,
      cwd: session.cwd,
      cols: session.ptyProcess.cols,
      rows: session.ptyProcess.rows,
      pid: session.ptyProcess.pid,
    };
  }

  list(): PtySessionInfo[] {
    return [...this.sessions.keys()].map((id) => this.info(id));
  }

  dispose(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (!session.exited) {
      session.ptyProcess.kill();
    }
    this.sessions.delete(id);
  }

  disposeAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.dispose(id);
    }
  }

  private requireSession(id: string): ActiveSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundError(`Terminal session not found: ${id}`);
    }
    return session;
  }
}

export const terminalManager = new TerminalManager();
