import { BadRequestException, Injectable } from '@nestjs/common';
import { GitService } from '@deepseek-harness/git';
import { PrismaService } from '../common/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class GitApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  private async svc(ownerId: string, projectId: string): Promise<{ git: GitService; projectId: string }> {
    const workspace = await this.projects.assertOwner(ownerId, projectId);
    return { git: new GitService(workspace), projectId };
  }

  private async record(ownerId: string, projectId: string, operation: string, fn: () => Promise<unknown>): Promise<unknown> {
    try {
      const result = await fn();
      await this.prisma.gitOperation.create({
        data: { projectId, operation, status: 'success', branch: null },
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.gitOperation.create({ data: { projectId, operation, status: 'failed', error: message } }).catch(() => undefined);
      await this.audit.log({ userId: ownerId, action: `git.${operation}`, resourceType: 'project', resourceId: projectId, metadata: { error: message } });
      throw new BadRequestException(message);
    }
  }

  status(ownerId: string, projectId: string) {
    return this.svc(ownerId, projectId).then(({ git }) => git.status());
  }

  diff(ownerId: string, projectId: string, path?: string, staged = false) {
    return this.svc(ownerId, projectId).then(({ git }) => git.diff(path, staged));
  }

  log(ownerId: string, projectId: string, count = 50) {
    return this.svc(ownerId, projectId).then(({ git }) => git.log(count));
  }

  branches(ownerId: string, projectId: string) {
    return this.svc(ownerId, projectId).then(({ git }) => git.branches());
  }

  checkout(ownerId: string, projectId: string, branch: string) {
    return this.record(ownerId, projectId, 'checkout', async () => {
      const { git } = await this.svc(ownerId, projectId);
      await git.checkout(branch);
      return { ok: true };
    });
  }

  stage(ownerId: string, projectId: string, paths: string[]) {
    return this.record(ownerId, projectId, 'stage', async () => {
      const { git } = await this.svc(ownerId, projectId);
      await git.stage(paths);
      return { ok: true };
    });
  }

  unstage(ownerId: string, projectId: string, paths: string[]) {
    return this.record(ownerId, projectId, 'unstage', async () => {
      const { git } = await this.svc(ownerId, projectId);
      await git.unstage(paths);
      return { ok: true };
    });
  }

  commit(ownerId: string, projectId: string, message: string) {
    return this.record(ownerId, projectId, 'commit', async () => {
      const { git } = await this.svc(ownerId, projectId);
      const hash = await git.commit(message);
      return { hash };
    });
  }

  pull(ownerId: string, projectId: string) {
    return this.record(ownerId, projectId, 'pull', async () => {
      const { git } = await this.svc(ownerId, projectId);
      await git.pull();
      return { ok: true };
    });
  }

  push(ownerId: string, projectId: string) {
    return this.record(ownerId, projectId, 'push', async () => {
      const { git } = await this.svc(ownerId, projectId);
      await git.push();
      return { ok: true };
    });
  }
}
