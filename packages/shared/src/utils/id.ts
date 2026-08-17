import { randomBytes } from 'node:crypto';

/** CUID-style sortable, URL-safe identifier using the platform CSPRNG. */
export function createId(prefix = ''): string {
  const time = Date.now().toString(36);
  const rand = randomBytes(8).toString('base64url');
  const suffix = randomBytes(2).toString('hex');
  const body = `${time}${rand}${suffix}`;
  return prefix ? `${prefix}_${body}` : body;
}

export function createShortId(prefix = ''): string {
  const rand = randomBytes(6).toString('base64url');
  return prefix ? `${prefix}_${rand}` : rand;
}

export function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}
