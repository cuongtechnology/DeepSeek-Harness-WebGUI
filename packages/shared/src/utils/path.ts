import { resolve, normalize, sep, isAbsolute, join } from 'node:path';

/**
 * Path-traversal-safe helpers. All filesystem access in the API and worker
 * processes must be funnelled through these functions so that a malicious or
 * buggy request can never escape the project workspace root.
 */

/** Normalize a user-supplied relative path: strip leading slashes and `..`. */
export function normalizeRelativePath(input: string): string {
  const cleaned = input.replace(/\\/g, '/').replace(/^\/+/, '');
  return cleaned.replace(/\/+/g, '/');
}

/**
 * Resolve a user-controlled RELATIVE path inside `root`, guaranteeing the
 * result stays within `root`. Absolute paths are rejected (the only absolute
 * path the system may use is the workspace root itself). Throws on escape.
 */
export function resolveWithinRoot(root: string, relativePath: string): string {
  const normalizedRoot = resolve(root);
  if (isAbsolute(relativePath)) {
    throw new PathTraversalError(relativePath);
  }
  const candidate = resolve(normalizedRoot, normalizeRelativePath(relativePath));
  if (candidate !== normalizedRoot && !candidate.startsWith(normalizedRoot + sep)) {
    throw new PathTraversalError(relativePath);
  }
  return candidate;
}

/** True when a RELATIVE path would resolve inside `root` without escaping. */
export function isPathWithinRoot(root: string, relativePath: string): boolean {
  try {
    resolveWithinRoot(root, relativePath);
    return true;
  } catch {
    return false;
  }
}

/** True when an ABSOLUTE path lies within `root` (for validating stored paths). */
export function isAbsolutePathWithinRoot(root: string, absolutePath: string): boolean {
  const normalizedRoot = resolve(root);
  const candidate = resolve(absolutePath);
  return candidate === normalizedRoot || candidate.startsWith(normalizedRoot + sep);
}

/** Convert an absolute path to a POSIX-style relative path from `root`. */
export function toRelativePath(root: string, absolutePath: string): string {
  const rel = absolutePath.replace(resolve(root), '').replace(/^[/\\]+/, '');
  return rel.split(sep).join('/');
}

/** True when a path is absolute (only the workspace root may ever be absolute). */
export function isAbsolutePath(p: string): boolean {
  return isAbsolute(p);
}

/** Join path segments POSIX-style for display purposes. */
export function joinPosix(...parts: string[]): string {
  return normalize(parts.join('/')).split(sep).join('/');
}

export class PathTraversalError extends Error {
  constructor(public readonly path: string) {
    super(`Path traversal blocked: ${path}`);
    this.name = 'PathTraversalError';
  }
}

export { join };
