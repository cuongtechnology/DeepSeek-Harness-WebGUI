import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { readdir, readFile, writeFile, mkdir, rm, stat, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  MAX_FILE_SIZE_BYTES,
  PathTraversalError,
  resolveWithinRoot,
  type FileReadResult,
  type WorkspaceFileEntry,
} from '@deepseek-harness/shared';
import { PrismaService } from '../common/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  private async resolve(ownerId: string, projectId: string, relativePath: string): Promise<string> {
    const root = await this.projects.assertOwner(ownerId, projectId);
    try {
      return resolveWithinRoot(root, relativePath || '.');
    } catch (error) {
      if (error instanceof PathTraversalError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  async list(ownerId: string, projectId: string, path = ''): Promise<WorkspaceFileEntry[]> {
    const dir = await this.resolve(ownerId, projectId, path);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      throw new NotFoundException('Directory not found');
    }

    const result: WorkspaceFileEntry[] = [];
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      const isDir = entry.isDirectory();
      let size: number | undefined;
      let modifiedAt: string | undefined;
      if (!isDir) {
        try {
          const s = await stat(entryPath);
          size = s.size;
          modifiedAt = s.mtime.toISOString();
        } catch {
          // entry vanished between readdir and stat
        }
      }
      result.push({
        path: path ? `${path}/${entry.name}` : entry.name,
        name: entry.name,
        type: isDir ? 'directory' : 'file',
        size,
        modifiedAt,
      });
    }
    return result.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
  }

  async tree(ownerId: string, projectId: string): Promise<WorkspaceFileEntry[]> {
    const root = await this.projects.assertOwner(ownerId, projectId);
    const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', '.turbo', 'coverage']);
    const results: WorkspaceFileEntry[] = [];

    const walk = async (dir: string, rel: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (SKIP.has(entry.name)) continue;
        const abs = join(dir, entry.name);
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(abs, childRel);
        } else {
          let size: number | undefined;
          try {
            size = (await stat(abs)).size;
          } catch {
            // vanished between readdir and stat
          }
          results.push({ path: childRel, name: entry.name, type: 'file', size });
        }
      }
    };

    await walk(root, '');
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  async read(ownerId: string, projectId: string, path: string): Promise<FileReadResult> {
    const file = await this.resolve(ownerId, projectId, path);
    const s = await stat(file).catch(() => {
      throw new NotFoundException('File not found');
    });
    if (s.isDirectory()) throw new BadRequestException('Path is a directory');

    if (s.size > MAX_FILE_SIZE_BYTES) {
      const content = await readFile(file, 'utf8');
      return { path, content: content.slice(0, MAX_FILE_SIZE_BYTES), truncated: true, size: s.size };
    }
    const content = await readFile(file, 'utf8');
    return { path, content, truncated: false, size: s.size };
  }

  async write(ownerId: string, projectId: string, path: string, content: string) {
    if (typeof content !== 'string' || content.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File content too large');
    }
    const file = await this.resolve(ownerId, projectId, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
    await this.audit.log({ userId: ownerId, action: 'file.write', resourceType: 'project', resourceId: projectId, metadata: { path } });
    return { path };
  }

  async createFile(ownerId: string, projectId: string, path: string) {
    return this.write(ownerId, projectId, path, '');
  }

  async createDir(ownerId: string, projectId: string, path: string) {
    const dir = await this.resolve(ownerId, projectId, path);
    await mkdir(dir, { recursive: true });
    return { path };
  }

  async remove(ownerId: string, projectId: string, path: string) {
    const target = await this.resolve(ownerId, projectId, path);
    const s = await stat(target).catch(() => {
      throw new NotFoundException('Path not found');
    });
    await rm(target, { recursive: s.isDirectory(), force: true });
    await this.audit.log({ userId: ownerId, action: 'file.delete', resourceType: 'project', resourceId: projectId, metadata: { path } });
    return { ok: true };
  }

  async rename(ownerId: string, projectId: string, oldPath: string, newPath: string) {
    const from = await this.resolve(ownerId, projectId, oldPath);
    const to = await this.resolve(ownerId, projectId, newPath);
    await rename(from, to);
    await this.audit.log({ userId: ownerId, action: 'file.rename', resourceType: 'project', resourceId: projectId, metadata: { oldPath, newPath } });
    return { ok: true };
  }
}
