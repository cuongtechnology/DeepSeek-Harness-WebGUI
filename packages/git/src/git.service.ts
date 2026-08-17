import simpleGit, { type SimpleGit } from 'simple-git';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GitError } from '@deepseek-harness/shared';

export interface GitStatusFile {
  path: string;
  /** Two-char XY status (index + worktree), e.g. "M ", "A ", "??". */
  status: string;
  staged: boolean;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string | null;
  files: GitStatusFile[];
  ahead: number;
  behind: number;
}

export interface GitDiffResult {
  path: string;
  diff: string;
}

export interface GitDiffPair {
  path: string;
  original: string;
  modified: string;
  binary: boolean;
  kind: 'added' | 'deleted' | 'modified';
}

export interface GitLogEntry {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
}

/**
 * Git operations scoped to one project workspace. Every operation runs via the
 * system git executable (through simple-git) with the workspace as the base
 * directory, so it can never touch paths outside the project.
 */
export class GitService {
  private readonly git: SimpleGit;

  constructor(private readonly workspacePath: string) {
    this.git = simpleGit({ baseDir: workspacePath });
  }

  async isRepo(): Promise<boolean> {
    return this.git.checkIsRepo();
  }

  async status(): Promise<GitStatusResult> {
    if (!(await this.isRepo())) {
      return { isRepo: false, branch: null, files: [], ahead: 0, behind: 0 };
    }
    const s = await this.git.status();
    return {
      isRepo: true,
      branch: s.current,
      files: s.files.map((f) => ({
        path: f.path,
        status: `${f.index}${f.working_dir}`,
        staged: f.index !== ' ' && f.index !== '?',
      })),
      ahead: s.ahead,
      behind: s.behind,
    };
  }

  async diff(path?: string, staged = false): Promise<GitDiffResult[]> {
    if (!(await this.isRepo())) return [];
    const args = staged ? ['--cached'] : [];
    if (path) args.push('--', path);
    const raw = await this.git.diff(args);
    if (!raw) return [];
    return [{ path: path ?? '', diff: raw }];
  }

  /**
   * Resolve both sides of a file's diff (before / after) so the frontend can
   * render it in a real diff editor instead of parsing the unified text.
   *
   * `staged` selects the diff baseline exactly like `git diff --cached` vs
   * `git diff`: HEAD→index for staged, index→worktree for unstaged. New and
   * deleted files are reconstructed with an empty side; untracked files
   * (no index/HEAD entry) surface as an empty original + full worktree text.
   */
  async diffPair(path: string, staged = false): Promise<GitDiffPair | null> {
    if (!(await this.isRepo())) return null;

    const blob = async (spec: string): Promise<string | null> => {
      try {
        return await this.git.show([`${spec}:${path}`]);
      } catch {
        return null;
      }
    };

    let original: string;
    let modified: string;
    let kind: GitDiffPair['kind'] = 'modified';

    if (staged) {
      const head = await blob('HEAD');
      const index = await blob('');
      if (head === null && index !== null) kind = 'added';
      else if (index === null && head !== null) kind = 'deleted';
      original = head ?? '';
      modified = index ?? '';
    } else {
      const index = await blob('');
      const head = await blob('HEAD');
      const worktree = await readFile(join(this.workspacePath, path), 'utf8').catch(() => null);
      if (index === null && worktree !== null) kind = 'added';
      else if (worktree === null && index !== null) kind = 'deleted';
      original = index ?? head ?? '';
      modified = worktree ?? '';
    }

    const hasNullByte = (s: string) => s.indexOf('\0') !== -1;
    return { path, original, modified, binary: hasNullByte(original) || hasNullByte(modified), kind };
  }

  async show(path: string): Promise<string> {
    return this.git.show([`HEAD:${path}`]);
  }

  async log(count = 50): Promise<GitLogEntry[]> {
    if (!(await this.isRepo())) return [];
    const log = await this.git.log({ maxCount: count });
    return log.all.map((e) => ({
      hash: e.hash,
      author: e.author_name,
      email: e.author_email,
      date: e.date,
      message: e.message,
    }));
  }

  async branches(): Promise<GitBranchInfo[]> {
    if (!(await this.isRepo())) return [];
    const b = await this.git.branch();
    return b.all.map((name) => ({ name, current: name === b.current }));
  }

  async currentBranch(): Promise<string | null> {
    if (!(await this.isRepo())) return null;
    const s = await this.git.status();
    return s.current;
  }

  async checkout(branch: string): Promise<void> {
    await this.wrap(() => this.git.checkout(branch));
  }

  async stage(paths: string[]): Promise<void> {
    await this.wrap(() => this.git.add(paths));
  }

  async unstage(paths: string[]): Promise<void> {
    await this.wrap(() => this.git.reset(['HEAD', '--', ...paths]));
  }

  async commit(message: string): Promise<string> {
    const result = await this.wrap(() => this.git.commit(message));
    return result.commit;
  }

  async pull(): Promise<void> {
    await this.wrap(() => this.git.pull());
  }

  async push(): Promise<void> {
    await this.wrap(() => this.git.push());
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new GitError(error instanceof Error ? error.message : String(error));
    }
  }
}
