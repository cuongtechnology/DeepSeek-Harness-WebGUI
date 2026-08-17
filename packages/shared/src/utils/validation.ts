/** Small, dependency-free validation helpers (see also zod where richer schemas are needed). */

export function isNonEmptyString(value: unknown, max = 512): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export function isEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

export function isSafeProjectName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 80 && /^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/.test(trimmed);
}

/** Reject path segments containing traversal or control characters. */
export function isSafePathSegment(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.includes('\0')) return false;
  if (value === '..' || value === '.') return false;
  return !value.split('/').some((seg) => seg === '..');
}

/** Reject control characters and NUL in any free-form string. */
export function hasControlChars(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
