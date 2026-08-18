import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AgentAdapterRegistry } from '@deepseek-harness/agent-sdk';
import type {
  AgentEvent,
  PermissionCategory,
  PermissionDecision,
} from '@deepseek-harness/shared';
import { createAdapterRegistry } from './adapters';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { PermissionsService } from '../common/permissions.service';
import { RuntimeConfigService, type RuntimeConfig, type RuntimeConfigUpdate } from '../common/runtime-config.service';
import { CreateSessionDto } from './dto/agent.dto';
import type {
  AgentEvent as AgentEventRecord,
  AgentSession as AgentSessionRecord,
  ApprovalRequest as ApprovalRequestRecord,
  Message as MessageRecord,
} from '@deepseek-harness/database';

type SessionWithProject = AgentSessionRecord & { project: { id: string; name: string } };

interface PendingApproval {
  id: string;
  projectId: string;
  sessionId: string;
  category: PermissionCategory;
  action: string;
}

@Injectable()
export class AgentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Agents');
  readonly events = new EventEmitter();
  private readonly registry: AgentAdapterRegistry = createAdapterRegistry();
  private readonly pendingApprovals = new Map<string, PendingApproval>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const cfg = await this.runtimeConfig.load().catch(() => null);
    if (cfg) this.applyRuntimeConfig(cfg);
  }

  async listRuntimes() {
    const adapters = this.registry.list();
    return Promise.all(
      adapters.map(async (adapter) => {
        const info = await adapter.detect();
        return {
          id: adapter.id,
          name: adapter.name,
          description: adapter.description,
          capabilities: adapter.capabilities ?? [],
          supportsApprovalResponses: adapter.supportsApprovalResponses ?? false,
          available: info.available,
          version: info.version,
          command: info.command,
          reason: info.reason,
          installable: info.installable ?? false,
          installMethods: info.installMethods ?? [],
        };
      }),
    );
  }

  async installRuntime(ownerId: string, adapterId: string, method?: string) {
    const adapter = this.registry.get(adapterId);
    if (!adapter.install) {
      throw new BadRequestException(`Runtime "${adapterId}" does not support on-demand installation`);
    }
    const result = await adapter.install({ method });
    await this.audit.log({
      userId: ownerId,
      action: 'runtime.install',
      resourceType: 'runtime',
      resourceId: adapterId,
      metadata: { method: method ?? null, success: result.success },
    });
    return result;
  }

  getRuntimeConfig() {
    return this.runtimeConfig.load().then((cfg) => this.runtimeConfig.toPublic(cfg));
  }

  async updateRuntimeConfig(ownerId: string, dto: RuntimeConfigUpdate) {
    const cfg = await this.runtimeConfig.save(dto);
    this.applyRuntimeConfig(cfg);
    await this.audit.log({
      userId: ownerId,
      action: 'runtime.config_update',
      resourceType: 'runtime',
      resourceId: 'deepseek-harness',
      metadata: { provider: cfg.provider, model: cfg.model, apiKeySet: Boolean(cfg.apiKey), baseUrlSet: Boolean(cfg.baseUrl) },
    });
    return this.runtimeConfig.toPublic(cfg);
  }

  async startSession(ownerId: string, projectId: string, dto: CreateSessionDto) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, ownerId } });
    if (!project) throw new NotFoundException('Project not found');

    const adapterId = dto.adapterId ?? this.registry.list()[0]?.id;
    if (!adapterId) throw new BadRequestException('No agent runtimes are available');
    const adapter = this.registry.get(adapterId);
    // Use the project's stored workspace path (single source of truth, shared
    // with files/git/terminal). Recomputing from WORKSPACES_ROOT here would
    // diverge if the root env changed after the project was created.
    const workspacePath = project.workspacePath;

    const sessionId = `session-${randomUUID().replaceAll('-', '')}`;

    const session = await this.prisma.agentSession.create({
      data: {
        id: sessionId,
        projectId: project.id,
        adapterId,
        status: 'starting',
        title: dto.title,
        model: dto.model,
        startedById: ownerId,
      },
    });

    await adapter.startSession({
      sessionId,
      projectId: project.id,
      workspacePath,
      model: dto.model,
      onEvent: (event) => this.handleEvent(sessionId, event),
    });

    await this.audit.log({ userId: ownerId, action: 'session.start', resourceType: 'session', resourceId: sessionId });
    return session;
  }

  async sendMessage(ownerId: string, sessionId: string, message: string) {
    const session = await this.requireSession(ownerId, sessionId);
    const adapter = this.registry.get(session.adapterId);

    await this.prisma.message.create({
      data: { sessionId, role: 'user', content: message },
    });

    await adapter.sendMessage(sessionId, message);
    return { ok: true };
  }

  async stopSession(ownerId: string, sessionId: string) {
    const session = await this.requireSession(ownerId, sessionId);
    const adapter = this.registry.get(session.adapterId);
    await adapter.stopSession(sessionId);
    await this.audit.log({ userId: ownerId, action: 'session.stop', resourceType: 'session', resourceId: sessionId });
    return { ok: true };
  }

  async listSessions(ownerId: string, projectId?: string): Promise<SessionWithProject[]> {
    return this.prisma.agentSession.findMany({
      where: { projectId, project: { ownerId } },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async getSession(ownerId: string, sessionId: string): Promise<SessionWithProject & { approvalResponsesSupported: boolean }> {
    const session = await this.prisma.agentSession.findFirst({
      where: { id: sessionId, project: { ownerId } },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    const adapter = this.registry.get(session.adapterId);
    return { ...session, approvalResponsesSupported: adapter.supportsApprovalResponses ?? false };
  }

  async getMessages(ownerId: string, sessionId: string): Promise<MessageRecord[]> {
    await this.requireSession(ownerId, sessionId);
    return this.prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
  }

  async getEvents(ownerId: string, sessionId: string): Promise<AgentEventRecord[]> {
    await this.requireSession(ownerId, sessionId);
    return this.prisma.agentEvent.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
  }

  async resolveApproval(ownerId: string, requestId: string, decision: PermissionDecision) {
    const pending = this.pendingApprovals.get(requestId);
    const record = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!record && !pending) throw new NotFoundException('Approval request not found');

    if (record) {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: decision === 'deny' ? 'denied' : 'allowed', decision, decidedBy: ownerId, decidedAt: new Date() },
      });
    }

    if (pending) {
      this.pendingApprovals.delete(requestId);
      const event: AgentEvent = { type: 'approval_result', requestId, decision, timestamp: new Date().toISOString() };
      this.emit(pending.sessionId, event);
      this.persistEvent(pending.sessionId, event);
    }

    await this.audit.log({ userId: ownerId, action: 'approval.resolve', resourceType: 'approval', resourceId: requestId, metadata: { decision } });
    return { ok: true };
  }

  listPendingApprovals(ownerId: string): Promise<ApprovalRequestRecord[]> {
    return this.prisma.approvalRequest.findMany({
      where: { status: 'pending', project: { ownerId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Handle a normalized event from an adapter: persist, fan out, gate approvals. */
  private async handleEvent(sessionId: string, event: AgentEvent): Promise<void> {
    this.emit(sessionId, event);
    void this.persistEvent(sessionId, event);

    if (event.type === 'status') {
      await this.prisma.agentSession
        .update({ where: { id: sessionId }, data: { status: event.status as never, ...(event.status === 'completed' || event.status === 'failed' || event.status === 'stopped' ? { endedAt: new Date() } : {}) } })
        .catch(() => undefined);
    }

    if (event.type === 'approval_request') {
      void this.gateApproval(sessionId, event);
    }
  }

  private async gateApproval(sessionId: string, event: Extract<AgentEvent, { type: 'approval_request' }>) {
    const session = await this.prisma.agentSession.findUnique({ where: { id: sessionId } }).catch(() => null);
    if (!session) return;

    const decision = this.permissions.evaluate(session.projectId, event.category);
    if (decision === 'allow_always' || decision === 'deny') {
      const result: AgentEvent = { type: 'approval_result', requestId: event.id, decision, timestamp: new Date().toISOString() };
      this.emit(sessionId, result);
      void this.persistEvent(sessionId, result);
      return;
    }

    // `ask`: record a pending approval and wait for a human decision.
    await this.prisma.approvalRequest
      .create({
        data: { id: event.id, projectId: session.projectId, sessionId, category: event.category, action: event.action, status: 'pending' },
      })
      .catch(() => undefined);

    this.pendingApprovals.set(event.id, {
      id: event.id,
      projectId: session.projectId,
      sessionId,
      category: event.category,
      action: event.action,
    });

    await this.prisma.agentSession.update({ where: { id: sessionId }, data: { status: 'waiting_for_approval' } }).catch(() => undefined);
  }

  private emit(sessionId: string, event: AgentEvent): void {
    this.events.emit('session', sessionId, event);
  }

  private async persistEvent(sessionId: string, event: AgentEvent): Promise<void> {
    await this.prisma.agentEvent
      .create({ data: { sessionId, type: event.type, payload: event as unknown as object } })
      .catch(() => undefined);
  }

  private async requireSession(ownerId: string, sessionId: string) {
    const session = await this.prisma.agentSession.findFirst({
      where: { id: sessionId, project: { ownerId } },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async onModuleDestroy(): Promise<void> {
    for (const adapter of this.registry.list()) {
      await adapter.disposeAll?.().catch(() => undefined);
    }
  }

  private applyRuntimeConfig(cfg: RuntimeConfig): void {
    for (const adapter of this.registry.list()) {
      const a = adapter as unknown as { reconfigure?: (config: Partial<RuntimeConfig>) => void };
      a.reconfigure?.({
        provider: cfg.provider,
        model: cfg.model,
        maxTokens: cfg.maxTokens,
        baseUrl: cfg.baseUrl,
        command: cfg.command,
        args: cfg.args,
        cordisConfig: cfg.cordisConfig,
        apiKey: cfg.apiKey,
      });
    }
  }
}
