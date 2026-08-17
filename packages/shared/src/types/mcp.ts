export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Redacted view of a server config — never includes env secret values. */
export interface McpServerPublic {
  id: string;
  name: string;
  enabled: boolean;
  transport: 'stdio';
  command: string;
  args: string[];
  /** Whether env vars are configured; values are never returned. */
  hasEnv: boolean;
  status: McpConnectionStatus;
  tools: McpTool[];
  createdAt: string;
  updatedAt: string;
}

export interface McpServerInput {
  name: string;
  enabled?: boolean;
  transport?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpToolCallRequest {
  serverId: string;
  tool: string;
  arguments: Record<string, unknown>;
}
