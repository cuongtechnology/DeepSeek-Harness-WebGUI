export interface TerminalSessionInfo {
  id: string;
  projectId: string;
  title: string;
  cwd: string;
  createdAt: string;
}

/** Server -> client terminal frames. */
export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface TerminalResizeEvent {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalInputEvent {
  sessionId: string;
  data: string;
}
