export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapterId?: string,
    public readonly sessionId?: string,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class AdapterNotFoundError extends AdapterError {
  constructor(adapterId: string) {
    super(`Agent adapter not found: ${adapterId}`, adapterId);
    this.name = 'AdapterNotFoundError';
  }
}

export class DuplicateAdapterError extends AdapterError {
  constructor(adapterId: string) {
    super(`Agent adapter already registered: ${adapterId}`, adapterId);
    this.name = 'DuplicateAdapterError';
  }
}

export class SessionNotFoundError extends AdapterError {
  constructor(adapterId: string, sessionId: string) {
    super(`Agent session not found: ${sessionId}`, adapterId, sessionId);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionAlreadyRunningError extends AdapterError {
  constructor(adapterId: string, sessionId: string) {
    super(`Agent session already running: ${sessionId}`, adapterId, sessionId);
    this.name = 'SessionAlreadyRunningError';
  }
}
