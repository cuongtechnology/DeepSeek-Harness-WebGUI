import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { isEmail, isSafeProjectName, isSafePathSegment, hasControlChars } from './validation';
import { createId, isId } from './id';

describe('password hashing', () => {
  it('hashes and verifies a password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(hash).toContain('scrypt$');
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('secret');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces unique salts', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });
});

describe('validation', () => {
  it('validates emails', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('not-an-email')).toBe(false);
  });

  it('validates project names', () => {
    expect(isSafeProjectName('My Project 2')).toBe(true);
    expect(isSafeProjectName('../../etc')).toBe(false);
    expect(isSafeProjectName('has\0nul')).toBe(false);
  });

  it('rejects traversal path segments', () => {
    expect(isSafePathSegment('src/index.ts')).toBe(true);
    expect(isSafePathSegment('..')).toBe(false);
    expect(isSafePathSegment('a/../../b')).toBe(false);
  });

  it('detects control characters', () => {
    expect(hasControlChars('ok')).toBe(false);
    expect(hasControlChars('bad\u0000char')).toBe(true);
  });
});

describe('id generation', () => {
  it('creates unique, valid ids', () => {
    const a = createId('prj');
    const b = createId('prj');
    expect(a).not.toBe(b);
    expect(isId(a)).toBe(true);
    expect(a.startsWith('prj_')).toBe(true);
  });
});
