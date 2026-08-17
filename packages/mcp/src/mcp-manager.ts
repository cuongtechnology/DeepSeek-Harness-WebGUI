import type { McpConnectionStatus } from '@deepseek-harness/shared';
import { McpStdioClient, McpTool } from './mcp-client';

export interface McpServerConnectionConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

interface ConnectionState {
  client: McpStdioClient;
  tools: McpTool[];
  serverInfo: { name: string; version: string };
}

/**
 * Manages live MCP server connections. Server configurations (including
 * secrets) are persisted by the API in the database; this class only holds
 * in-memory connections and never returns env values.
 */
export class McpServerManager {
  private readonly connections = new Map<string, ConnectionState>();
  private readonly statuses = new Map<string, McpConnectionStatus>();

  async connect(config: McpServerConnectionConfig): Promise<{ serverInfo: { name: string; version: string }; tools: McpTool[] }> {
    await this.disconnect(config.id);

    this.statuses.set(config.id, 'connecting');
    const client = new McpStdioClient({
      command: config.command,
      args: config.args,
      env: config.env,
      timeoutMs: 10_000,
    });

    try {
      const { serverInfo } = await client.connect();
      const tools = await client.listTools();
      this.connections.set(config.id, { client, tools, serverInfo });
      this.statuses.set(config.id, 'connected');
      return { serverInfo, tools };
    } catch (error) {
      this.statuses.set(config.id, 'error');
      await client.close().catch(() => undefined);
      throw error;
    }
  }

  async disconnect(id: string): Promise<void> {
    const state = this.connections.get(id);
    if (state) {
      await state.client.close().catch(() => undefined);
      this.connections.delete(id);
    }
    this.statuses.set(id, 'disconnected');
  }

  async callTool(id: string, tool: string, args: Record<string, unknown>): Promise<{ content: unknown; isError: boolean }> {
    const state = this.connections.get(id);
    if (!state) throw new Error(`MCP server not connected: ${id}`);
    return state.client.callTool(tool, args);
  }

  getStatus(id: string): McpConnectionStatus {
    return this.statuses.get(id) ?? 'disconnected';
  }

  getTools(id: string): McpTool[] {
    return this.connections.get(id)?.tools ?? [];
  }

  getServerInfo(id: string): { name: string; version: string } | undefined {
    return this.connections.get(id)?.serverInfo;
  }

  listConnected(): string[] {
    return [...this.connections.keys()];
  }

  async disconnectAll(): Promise<void> {
    for (const id of [...this.connections.keys()]) {
      await this.disconnect(id);
    }
  }
}

export const mcpServerManager = new McpServerManager();
