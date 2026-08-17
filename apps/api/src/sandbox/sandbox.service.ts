import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../common/audit.service';

const execFileAsync = promisify(execFile);

export interface SandboxOptions {
  ownerId: string;
  projectId: string;
  image?: string;
  workspacePath: string;
  networkDisabled?: boolean;
}

export interface SandboxInfo {
  id: string;
  status: 'running' | 'stopped' | 'destroyed';
  containerName?: string;
  workspacePath: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Abstraction over isolated agent execution environments. */
export interface SandboxManager {
  create(options: SandboxOptions): Promise<SandboxInfo>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  exec(id: string, command: string): Promise<ExecResult>;
}

/**
 * Docker-backed sandbox. Each sandbox is a container that bind-mounts the
 * project workspace read-write at /workspace and runs no services by default.
 * Containers are unprivileged (no --privileged); network can be disabled.
 * See docs/security.md for the exact boundary and limitations.
 */
@Injectable()
export class DockerSandboxManager implements SandboxManager {
  private readonly containers = new Map<string, string>(); // sandboxId -> container name
  private readonly image = process.env.SANDBOX_IMAGE ?? 'node:22-slim';

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  async create(options: SandboxOptions): Promise<SandboxInfo> {
    const workspace = await this.projects.assertOwner(options.ownerId, options.projectId);
    const id = `sbx-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const containerName = `dhwg-${id}`;
    const args = [
      'run',
      '-d',
      '--name',
      containerName,
      '--workdir',
      '/workspace',
      '-v',
      `${workspace}:/workspace`,
      ...(options.networkDisabled ? ['--network', 'none'] : []),
      options.image ?? this.image,
      'tail',
      '-f',
      '/dev/null',
    ];
    try {
      await execFileAsync('docker', args);
    } catch (error) {
      throw new BadRequestException(`Failed to create sandbox: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.containers.set(id, containerName);
    await this.audit.log({ userId: options.ownerId, action: 'sandbox.create', resourceType: 'project', resourceId: options.projectId, metadata: { sandboxId: id } });
    return { id, status: 'running', containerName, workspacePath: workspace };
  }

  async start(id: string): Promise<void> {
    await execFileAsync('docker', ['start', this.name(id)]);
  }

  async stop(id: string): Promise<void> {
    await execFileAsync('docker', ['stop', this.name(id)]);
  }

  async destroy(id: string): Promise<void> {
    await execFileAsync('docker', ['rm', '-f', this.name(id)]);
    this.containers.delete(id);
  }

  async exec(id: string, command: string): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await execFileAsync('docker', ['exec', this.name(id), 'sh', '-c', command], {
        timeout: 120_000,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return { stdout: e.stdout ?? '', stderr: e.stderr ?? String(error), exitCode: e.code ?? 1 };
    }
  }

  private name(id: string): string {
    const name = this.containers.get(id);
    if (!name) throw new NotFoundException('Sandbox not found');
    return name;
  }
}
