import { describe, expect, it } from 'vitest';
import { INSTALL_METHODS, platformTag } from './installer';
import { loadHarnessConfig } from './config';

describe('installer', () => {
  it('exposes the two verified install methods (pip and source, not npm)', () => {
    expect(INSTALL_METHODS).toEqual(['pip', 'source']);
  });

  it('computes a platform tag matching upstream executable naming', () => {
    const tag = platformTag();
    expect(tag).toMatch(/^(linux|macos)-(x64|arm64)$/);
  });
});

describe('install configuration', () => {
  it('defaults the install method to pip', () => {
    expect(loadHarnessConfig({}).installMethod).toBe('pip');
  });

  it('parses the source install method', () => {
    expect(loadHarnessConfig({ DEEPSEEK_HARNESS_INSTALL_METHOD: 'source' }).installMethod).toBe('source');
  });

  it('falls back to pip for an unknown install method', () => {
    expect(loadHarnessConfig({ DEEPSEEK_HARNESS_INSTALL_METHOD: 'npx' }).installMethod).toBe('pip');
  });

  it('reads an explicit install command override', () => {
    const config = loadHarnessConfig({ DEEPSEEK_HARNESS_INSTALL_COMMAND: 'uv pip install deepseek-harness-sdk' });
    expect(config.installCommand).toBe('uv pip install deepseek-harness-sdk');
  });

  it('reads DSH_CORDIS_CONFIG into cordisConfig', () => {
    expect(loadHarnessConfig({ DSH_CORDIS_CONFIG: '/tmp/cordis.yml' }).cordisConfig).toBe('/tmp/cordis.yml');
  });
});
