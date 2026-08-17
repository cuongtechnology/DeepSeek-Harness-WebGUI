import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { terminalManager } from '@deepseek-harness/terminal';
import { PrismaService } from '../common/prisma.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class TerminalService implements OnModuleDestroy {
  readonly events = new EventEmitter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async create(ownerId: string, projectId: string, title?: string) {
    const workspace = await this.projects.assertOwner(ownerId, projectId);
    const id = `term-${randomUUID().replaceAll('-', '')}`;
    await this.prisma.terminalSession.create({
      data: { id, projectId, title: title ?? 'bash', cwd: workspace },
    });
    return { id, projectId, title: title ?? 'bash', cwd: workspace };
  }

  async list(ownerId: string, projectId: string) {
    await this.projects.assertOwner(ownerId, projectId);
    return this.prisma.terminalSession.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  async spawn(sessionId: string): Promise<void> {
    if (terminalManager.has(sessionId)) return;
    const session = await this.prisma.terminalSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Terminal session not found');

    terminalManager.create(sessionId, session.cwd, 80, 24, {
      onData: (data) => this.events.emit('output', sessionId, data),
      onExit: (code) => {
        this.events.emit('exit', sessionId, code);
        void this.prisma.terminalSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } }).catch(() => undefined);
      },
    });
  }

  write(sessionId: string, data: string): void {
    terminalManager.write(sessionId, data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    terminalManager.resize(sessionId, cols, rows);
  }

  async kill(ownerId: string, sessionId: string) {
    const session = await this.prisma.terminalSession.findFirst({
      where: { id: sessionId, project: { ownerId } },
    });
    if (!session) throw new NotFoundException('Terminal session not found');
    terminalManager.kill(sessionId);
    await this.prisma.terminalSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
    return { ok: true };
  }

  async onModuleDestroy(): Promise<void> {
    terminalManager.disposeAll();
  }
}
