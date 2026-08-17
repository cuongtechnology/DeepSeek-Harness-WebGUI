import { describe, it, expect } from 'vitest';
import { resolveWithinRoot, isPathWithinRoot, normalizeRelativePath, PathTraversalError } from './path';

describe('path safety', () => {
  it('resolves a normal relative path inside the root', () => {
    expect(resolveWithinRoot('/root/ws', 'src/index.ts')).toBe('/root/ws/src/index.ts');
  });

  it('blocks .. traversal', () => {
    expect(() => resolveWithinRoot('/root/ws', '../../etc/passwd')).toThrow(PathTraversalError);
    expect(() => resolveWithinRoot('/root/ws', '../secret')).toThrow(PathTraversalError);
  });

  it('blocks absolute path escape', () => {
    expect(() => resolveWithinRoot('/root/ws', '/etc/passwd')).toThrow(PathTraversalError);
  });

  it('allows the root itself', () => {
    expect(resolveWithinRoot('/root/ws', '.')).toBe('/root/ws');
  });

  it('isPathWithinRoot reports traversal as unsafe', () => {
    expect(isPathWithinRoot('/root/ws', 'a/b')).toBe(true);
    expect(isPathWithinRoot('/root/ws', '../../etc')).toBe(false);
  });

  it('normalizes backslashes and leading slashes', () => {
    expect(normalizeRelativePath('..\\..\\etc\\passwd')).toBe('../../etc/passwd');
    expect(normalizeRelativePath('/src/a')).toBe('src/a');
  });
});
