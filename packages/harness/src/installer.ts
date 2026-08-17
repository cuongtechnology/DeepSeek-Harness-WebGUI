import { spawn, type ChildProcess } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { InstallResult } from '@deepseek-harness/agent-sdk';
import type { HarnessConfig, InstallMethod } from './config';

/**
 * On-demand installer for the DeepSeek Harness runtime.
 *
 * The runtime (`dsh-jsonrpc-agent`) is NOT a plain npm package: the bare
 * `dsh-jsonrpc-agent` bin lives in the upstream `jsonrpc-demo` example and is
 * not published, while `@deepseek-ai/dsh` only ships the `dsh` CLI. The two
 * real acquisition routes (verified against upstream) are:
 *
 *   pip     — `python3 -m pip install deepseek-harness-sdk`, which installs the
 *             platform `deepseek-harness-runtime-bin` wheel bundling the
 *             single-file executable + default `cordis.yml`, located via the
 *             `deepseek_harness_runtime` module. No Node needed on the target.
 *   source  — build from the upstream checkout: `git clone` + `pnpm install` +
 *             `pnpm exec tsx scripts/build-exe-for-python-sdk.ts`, producing
 *             `dist-exe/dsh-jsonrpc-agent-pkg-<platform>-<arch>`. Needs Node
 *             >= 22.19, pnpm, and a build toolchain.
 *
 * This module is deliberately opt-in: callers must obtain user consent before
 * invoking `installHarness`. Command output is redacted of secret-like env
 * values before being returned.
 */

export const INSTALL_METHODS: InstallMethod[] = ['pip', 'source'];

const UPSTREAM_REPO = 'https://github.com/deepseek-ai/deepseek-harness.git';
const DEFAULT_PIP_PACKAGE = 'deepseek-harness-sdk';
const SOURCE_DIR = join(homedir(), '.deepseek-harness-webgui', 'harness-source');

interface RunResult {
  code: number | null;
  output: string;
}

/** Map process.platform/arch to the upstream `dsh-jsonrpc-agent-pkg-<tag>` tag. */
export function platformTag(): string {
  const plat = process.platform === 'darwin' ? 'macos' : process.platform;
  const archMap: Record<string, string> = {
    x64: 'x64',
    x86_64: 'x64',
    amd64: 'x64',
    arm64: 'arm64',
    aarch64: 'arm64',
  };
  return `${plat}-${archMap[process.arch] ?? process.arch}`;
}

/** Mask values of secret-like environment variables that may leak into output. */
function redact(text: string): string {
  let out = text;
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 8) continue;
    if (/KEY|SECRET|TOKEN|PASSWORD|PASSWD/i.test(key)) {
      out = out.split(value).join('***');
    }
  }
  return out;
}

function run(command: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, { cwd: opts.cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ code: null, output: redact(error instanceof Error ? error.message : String(error)) });
      return;
    }

    let out = '';
    let settled = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs ?? 10 * 60 * 1000);
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output: redact(out.slice(-8000)) });
    };

    child.stdout?.on('data', (d: Buffer) => {
      out += d.toString('utf8');
    });
    child.stderr?.on('data', (d: Buffer) => {
      out += d.toString('utf8');
    });
    child.on('error', (error) => {
      out += `\n${error instanceof Error ? error.message : String(error)}`;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}

/** Resolve a bundled runtime path via the installed `deepseek_harness_runtime` module. */
async function locateBundled(attr: 'bundled_runtime_path' | 'bundled_default_config_path'): Promise<string | null> {
  const result = await run('python3', ['-c', `from deepseek_harness_runtime import ${attr}; print(${attr}())`], {
    timeoutMs: 60_000,
  });
  if (result.code !== 0) return null;
  const last = result.output
    .trim()
    .split('\n')
    .filter(Boolean)
    .pop();
  return last ? last.trim() : null;
}

async function installViaPip(config: HarnessConfig): Promise<InstallResult> {
  const argv = config.installCommand
    ? config.installCommand.split(/\s+/)
    : ['python3', '-m', 'pip', 'install', '--disable-pip-version-check', DEFAULT_PIP_PACKAGE];
  const command = argv[0];
  const args = argv.slice(1);
  if (!command) return { success: false, error: 'pip install command is empty' };

  const install = await run(command, args, { timeoutMs: 15 * 60 * 1000 });
  if (install.code !== 0) {
    return {
      success: false,
      error: `pip install failed (exit ${install.code ?? 'signal'}): ${install.output}`,
      output: install.output,
    };
  }

  const binary = await locateBundled('bundled_runtime_path');
  if (!binary) {
    return {
      success: false,
      error:
        'pip install succeeded, but the bundled dsh-jsonrpc-agent executable could not be located via deepseek_harness_runtime.bundled_runtime_path().',
      output: install.output,
    };
  }
  const configPath = await locateBundled('bundled_default_config_path');

  return { success: true, command: binary, configPath: configPath ?? undefined, output: install.output };
}

async function installFromSource(config: HarnessConfig): Promise<InstallResult> {
  const tag = platformTag();

  const clone = await run('git', ['clone', '--depth', '1', UPSTREAM_REPO, SOURCE_DIR], { timeoutMs: 10 * 60 * 1000 });
  if (clone.code !== 0) {
    const pull = await run('git', ['-C', SOURCE_DIR, 'pull', '--ff-only'], { timeoutMs: 5 * 60 * 1000 });
    if (pull.code !== 0) {
      return { success: false, error: `failed to clone ${UPSTREAM_REPO}: ${clone.output}`, output: clone.output };
    }
  }

  const install = await run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], {
    cwd: SOURCE_DIR,
    timeoutMs: 30 * 60 * 1000,
  });
  if (install.code !== 0) {
    return { success: false, error: `pnpm install failed: ${install.output}`, output: install.output };
  }

  const build = await run('pnpm', ['exec', 'tsx', 'scripts/build-exe-for-python-sdk.ts'], {
    cwd: SOURCE_DIR,
    timeoutMs: 30 * 60 * 1000,
  });
  if (build.code !== 0) {
    return { success: false, error: `runtime build failed: ${build.output}`, output: build.output };
  }

  const exe = join(SOURCE_DIR, 'dist-exe', `dsh-jsonrpc-agent-pkg-${tag}`);
  try {
    accessSync(exe, constants.X_OK);
  } catch {
    return { success: false, error: `build succeeded but the executable was not found at ${exe}`, output: build.output };
  }

  const configPath = join(SOURCE_DIR, 'examples', 'jsonrpc-agent', 'cordis.yml');
  return { success: true, command: exe, configPath, output: build.output };
}

/** Install the DeepSeek Harness runtime using the given method (opt-in). */
export async function installHarness(config: HarnessConfig, method: InstallMethod): Promise<InstallResult> {
  switch (method) {
    case 'source':
      return installFromSource(config);
    case 'pip':
    default:
      return installViaPip(config);
  }
}
