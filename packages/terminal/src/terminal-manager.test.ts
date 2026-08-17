import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TerminalManager } from './terminal-manager';

const dirs: string[] = [];
const managers: TerminalManager[] = [];

afterAll(() => {
  for (const m of managers) m.disposeAll();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('TerminalManager', () => {
  it('spawns a PTY, writes input and captures output', async () => {
    const manager = new TerminalManager();
    managers.push(manager);
    const dir = mkdtempSync(join(tmpdir(), 'dhwg-term-'));
    dirs.push(dir);

    const output: string[] = [];
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 4000);
      manager.create('t1', dir, 80, 24, {
        onData: (data) => {
          output.push(data);
          if (output.join('').includes('DHWG_TERM_OK')) {
            clearTimeout(timer);
            resolve();
          }
        },
        onExit: () => undefined,
      });
      manager.write('t1', 'echo DHWG_TERM_OK\r');
    });

    expect(output.join('')).toContain('DHWG_TERM_OK');
    expect(manager.has('t1')).toBe(true);
    manager.kill('t1');
    expect(manager.has('t1')).toBe(false);
  });

  it('throws for unknown sessions', () => {
    const manager = new TerminalManager();
    expect(() => manager.write('missing', 'x')).toThrow(/not found/);
  });
});
