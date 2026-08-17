import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { GitService } from './git.service';

let dir: string;

function run(cmd: string): void {
  execSync(cmd, { cwd: dir, stdio: 'ignore' });
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'dhwg-git-'));
  run('git init -q');
  run('git config user.email test@example.com');
  run('git config user.name "Test User"');
  writeFileSync(join(dir, 'a.txt'), 'hello\n');
  run('git add a.txt');
  run('git commit -q -m "initial"');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GitService', () => {
  it('reports status with branch and clean tree', async () => {
    const git = new GitService(dir);
    const status = await git.status();
    expect(status.isRepo).toBe(true);
    expect(status.branch).toBeTruthy();
    expect(status.files).toEqual([]);
  });

  it('detects changes and stages/commits them', async () => {
    const git = new GitService(dir);
    writeFileSync(join(dir, 'a.txt'), 'hello world\n');
    const status = await git.status();
    expect(status.files.some((f) => f.path === 'a.txt' && !f.staged)).toBe(true);

    await git.stage(['a.txt']);
    const staged = await git.status();
    expect(staged.files.some((f) => f.path === 'a.txt' && f.staged)).toBe(true);

    const hash = await git.commit('update a');
    expect(hash).toBeTruthy();
  });

  it('returns a diff for a changed file', async () => {
    const git = new GitService(dir);
    writeFileSync(join(dir, 'a.txt'), 'hello world again\n');
    const diffs = await git.diff();
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs[0].diff).toContain('hello world again');
  });

  it('returns the commit log', async () => {
    const git = new GitService(dir);
    const log = await git.log();
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(log[0].message).toBe('update a');
  });

  it('returns false for a non-repo directory', async () => {
    const git = new GitService(mkdtempSync(join(tmpdir(), 'dhwg-notrepo-')));
    const status = await git.status();
    expect(status.isRepo).toBe(false);
  });
});
