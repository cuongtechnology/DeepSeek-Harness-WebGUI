import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Symmetric encryption for secrets persisted in the database (e.g. the agent
 * runtime API key). Uses AES-256-GCM with a key derived from the same JWT
 * secret the API uses for auth, so no extra key material has to be managed.
 *
 * The value stored is `iv:authTag:ciphertext`, each part base64-encoded.
 */

const DEV_SECRET = 'insecure-dev-secret-change-me';

export function effectiveSecret(env: NodeJS.ProcessEnv = process.env): string {
  return (env.JWT_SECRET ?? '').trim() || DEV_SECRET;
}

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const key = keyFromSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Malformed secret payload');
  const [ivB64, tagB64, dataB64] = parts;
  const key = keyFromSecret(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
