import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { mcpServerManager } from '@deepseek-harness/mcp';
import type { McpServerPublic } from '@deepseek-harness/shared';
import { PrismaService } from '../common/prisma.service';

export interface CreateMcpServerDto {
  name: string;
  enabled?: boolean;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

@Injectable()
export class McpApiService implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<McpServerPublic[]> {
    const servers = await this.prisma.mcpServer.findMany({ orderBy: { name: 'asc' } });
    return servers.map((s) => this.toPublic(s));
  }

  async create(dto: CreateMcpServerDto): Promise<McpServerPublic> {
    const server = await this.prisma.mcpServer.create({
      data: {
        name: dto.name,
        enabled: dto.enabled ?? true,
        command: dto.command,
        args: dto.args ?? [],
        env: dto.env ?? {},
      },
    });
    return this.toPublic(server);
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    await mcpServerManager.disconnect(id).catch(() => undefined);
    await this.prisma.mcpServer.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('MCP server not found');
    });
    return { ok: true };
  }

  async update(id: string, dto: Partial<CreateMcpServerDto>): Promise<McpServerPublic> {
    const server = await this.prisma.mcpServer.update({
      where: { id },
      data: {
        name: dto.name,
        enabled: dto.enabled,
        command: dto.command,
        args: dto.args,
        env: dto.env,
      },
    });
    return this.toPublic(server);
  }

  async connect(id: string): Promise<McpServerPublic> {
    const server = await this.prisma.mcpServer.findUnique({ where: { id } });
    if (!server) throw new NotFoundException('MCP server not found');
    await mcpServerManager.connect({
      id: server.id,
      name: server.name,
      command: server.command,
      args: server.args as string[],
      env: server.env as Record<string, string>,
      enabled: server.enabled,
    });
    return this.toPublic(server);
  }

  async disconnect(id: string): Promise<{ ok: boolean }> {
    await mcpServerManager.disconnect(id);
    return { ok: true };
  }

  async getTools(id: string) {
    return mcpServerManager.getTools(id);
  }

  async callTool(id: string, tool: string, args: Record<string, unknown>) {
    return mcpServerManager.callTool(id, tool, args);
  }

  async onModuleDestroy(): Promise<void> {
    await mcpServerManager.disconnectAll();
  }

  /** Redacted view — never returns env secret values. */
  private toPublic(server: {
    id: string;
    name: string;
    enabled: boolean;
    transport: string;
    command: string;
    args: unknown;
    env: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): McpServerPublic {
    const env = (server.env ?? {}) as Record<string, string>;
    return {
      id: server.id,
      name: server.name,
      enabled: server.enabled,
      transport: server.transport as 'stdio',
      command: server.command,
      args: (server.args as string[]) ?? [],
      hasEnv: Object.keys(env).length > 0,
      status: mcpServerManager.getStatus(server.id),
      tools: mcpServerManager.getTools(server.id),
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString(),
    };
  }
}
