import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { watch, type FSWatcher } from 'node:fs';
import { EventEmitter } from 'node:events';

interface WatchHandle {
  watcher: FSWatcher;
  timer: NodeJS.Timeout | null;
}

/**
 * Watches project workspaces and emits debounced "something changed" events.
 * Used to push real-time file-tree updates to the browser (the harness runtime
 * has no file-change notification in its wire protocol, so the filesystem is
 * the source of truth).
 */
@Injectable()
export class FileWatcherService implements OnModuleDestroy {
  private readonly logger = new Logger('FileWatcher');
  readonly events = new EventEmitter();
  private readonly handles = new Map<string, WatchHandle>();

  /** Start watching a workspace (idempotent per project). */
  watch(projectId: string, workspacePath: string): void {
    if (this.handles.has(projectId)) return;

    let watcher: FSWatcher;
    try {
      watcher = watch(workspacePath, { recursive: true });
    } catch (error) {
      this.logger.warn(`Cannot watch ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const handle: WatchHandle = { watcher, timer: null };
    this.handles.set(projectId, handle);

    const onChange = () => {
      if (handle.timer) clearTimeout(handle.timer);
      handle.timer = setTimeout(() => {
        handle.timer = null;
        this.events.emit('change', { projectId });
      }, 300);
    };

    watcher.on('change', onChange);
    watcher.on('error', (error) => {
      this.logger.warn(`Watch error on ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  unwatch(projectId: string): void {
    const handle = this.handles.get(projectId);
    if (!handle) return;
    if (handle.timer) clearTimeout(handle.timer);
    handle.watcher.close();
    this.handles.delete(projectId);
  }

  onModuleDestroy(): void {
    for (const id of [...this.handles.keys()]) this.unwatch(id);
  }
}
