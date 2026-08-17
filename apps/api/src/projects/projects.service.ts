import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createId, isSafeProjectName, isAbsolutePathWithinRoot, resolveWithinRoot } from '@deepseek-harness/shared';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { projectWorkspace, workspaceRoot } from '../common/workspace';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

const execFileAsync = promisify(execFile);

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    if (!isSafeProjectName(dto.name)) {
      throw new BadRequestException('Project name contains invalid characters');
    }

    const id = createId('prj');
    const workspace = projectWorkspace(id);

    if (dto.sourceKind === 'local' && dto.sourcePath) {
      // Local directory source: must resolve inside WORKSPACES_ROOT (no host escape).
      resolveWithinRoot(workspaceRoot(), dto.sourcePath);
    }

    if (dto.sourceKind === 'git') {
      if (!dto.sourceUrl) throw new BadRequestException('sourceUrl is required for git projects');
      await mkdir(workspace, { recursive: true });
      try {
        await execFileAsync('git', ['clone', dto.sourceUrl, workspace]);
      } catch (error) {
        await rm(workspace, { recursive: true, force: true });
        throw new BadRequestException(
          `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      await mkdir(workspace, { recursive: true });
    }

    const project = await this.prisma.project.create({
      data: {
        id,
        name: dto.name,
        description: dto.description,
        workspacePath: workspace,
        sourceKind: dto.sourceKind,
        sourceUrl: dto.sourceUrl,
        sourceBranch: dto.sourceBranch,
        sandboxKind: dto.sandboxKind,
        sandboxImage: dto.sandboxImage,
        ownerId,
      },
    });

    if (dto.sourceKind === 'git' && dto.sourceUrl) {
      await this.prisma.repository.create({
        data: { projectId: id, url: dto.sourceUrl, branch: dto.sourceBranch },
      });
    }

    await this.audit.log({ userId: ownerId, action: 'project.create', resourceType: 'project', resourceId: id });
    return project;
  }

  async list(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(ownerId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, ownerId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(ownerId: string, id: string, dto: UpdateProjectDto) {
    await this.get(ownerId, id);
    return this.prisma.project.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
  }

  async remove(ownerId: string, id: string) {
    const project = await this.get(ownerId, id);
    // Guard: only allow removing workspaces that live under the workspace root.
    if (!isAbsolutePathWithinRoot(workspaceRoot(), project.workspacePath)) {
      throw new ForbiddenException('Workspace is outside the configured workspace root');
    }
    await this.prisma.project.delete({ where: { id } });
    await rm(project.workspacePath, { recursive: true, force: true }).catch(() => undefined);
    await this.audit.log({ userId: ownerId, action: 'project.delete', resourceType: 'project', resourceId: id });
    return { ok: true };
  }

  async assertOwner(ownerId: string, id: string): Promise<string> {
    const project = await this.get(ownerId, id);
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== ownerId) throw new ForbiddenException('Not your project');
    return project.workspacePath;
  }
}
