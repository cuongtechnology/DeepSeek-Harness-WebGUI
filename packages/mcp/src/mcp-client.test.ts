import { describe, it, expect, afterEach } from 'vitest';
import { McpStdioClient } from './mcp-client';

/**
 * A minimal stdio MCP server speaking JSON-RPC, exercised through `node -e`.
 */
const FAKE_MCP_SERVER = `
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return; // notification
  if (m.method === 'initialize') {
    out({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake-mcp', version: '1.0.0' } } });
  } else if (m.method === 'tools/list') {
    out({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'echo', description: 'echo a string', inputSchema: { type: 'object' } }] } });
  } else if (m.method === 'tools/call') {
    out({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'ok' }], isError: false } });
  }
});
function out(x) { process.stdout.write(JSON.stringify(x) + '\\n'); }
`;

const active: McpStdioClient[] = [];

afterEach(async () => {
  for (const client of active.splice(0)) await client.close();
});

describe('McpStdioClient', () => {
  it('connects, lists tools and calls a tool', async () => {
    const client = new McpStdioClient({ command: process.execPath, args: ['-e', FAKE_MCP_SERVER], timeoutMs: 3000 });
    active.push(client);

    const { serverInfo } = await client.connect();
    expect(serverInfo.name).toBe('fake-mcp');

    const tools = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('echo');

    const result = await client.callTool('echo', { text: 'hi' });
    expect(result.isError).toBe(false);
  });

  it('rejects when the server binary is unavailable', async () => {
    const client = new McpStdioClient({ command: '/definitely/not/a/real/mcp-server', timeoutMs: 2000 });
    active.push(client);
    await expect(client.connect()).rejects.toThrow();
  });
});
