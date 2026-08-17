/**
 * DeepSeek Harness integration configuration.
 *
 * The adapter drives the official `dsh-jsonrpc-agent` SDK runtime binary over
 * stdio JSON-RPC (the same wire protocol the official TypeScript/Python SDKs
 * use). The runtime executable is fully configurable; nothing is hard-coded.
 *
 *   DEEPSEEK_HARNESS_COMMAND       runtime executable (default `dsh-jsonrpc-agent`)
 *   DEEPSEEK_HARNESS_ARGS          extra runtime args, split on whitespace
 *   DEEPSEEK_HARNESS_PROVIDER      LLM provider route (default `deepseek-official`)
 *   DEEPSEEK_HARNESS_MODEL         model name (default `deepseek-v4-flash`)
 *   DEEPSEEK_HARNESS_MAX_TOKENS    optional max output tokens
 *   DEEPSEEK_HARNESS_TIMEOUT_MS    per-request timeout (default 5 min)
 *   DEEPSEEK_HARNESS_KILL_MS       grace between SIGTERM -> SIGKILL (default 3000)
 *
 *   DEEPSEEK_HARNESS_INSTALL_METHOD   on-demand install method: `pip` | `source`
 *   DEEPSEEK_HARNESS_INSTALL_COMMAND  optional explicit install command override
 *
 * The runtime reads DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL (LLM credentials) and
 * DSH_* variables (including DSH_CORDIS_CONFIG) from the inherited environment.
 * Secrets are never logged.
 */

export type InstallMethod = 'pip' | 'source';

export interface HarnessConfig {
  command: string;
  args: string[];
  provider: string;
  model: string;
  maxTokens?: number;
  /** LLM API key (DEEPSEEK_API_KEY) injected into the runtime env. */
  apiKey?: string;
  /** Optional LLM base URL override (DEEPSEEK_BASE_URL). */
  baseUrl?: string;
  requestTimeoutMs: number;
  disposeGraceMs: number;
  /** Runtime Cordis config path (DSH_CORDIS_CONFIG). */
  cordisConfig?: string;
  /** On-demand install method, used only when the runtime is missing. */
  installMethod: InstallMethod;
  /** Optional explicit install command override (split on whitespace). */
  installCommand?: string;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_KILL_MS = 3_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseInstallMethod(value: string | undefined): InstallMethod {
  if (value === 'source') return 'source';
  return 'pip';
}

export function loadHarnessConfig(env: NodeJS.ProcessEnv = process.env): HarnessConfig {
  const command = (env.DEEPSEEK_HARNESS_COMMAND ?? '').trim() || 'dsh-jsonrpc-agent';
  const argsRaw = (env.DEEPSEEK_HARNESS_ARGS ?? '').trim();
  const args = argsRaw ? argsRaw.split(/\s+/) : [];

  const maxTokensRaw = env.DEEPSEEK_HARNESS_MAX_TOKENS;
  const maxTokens = maxTokensRaw ? parsePositiveInt(maxTokensRaw, 0) || undefined : undefined;

  return {
    command,
    args,
    provider: (env.DEEPSEEK_HARNESS_PROVIDER ?? '').trim() || 'deepseek-official',
    model: (env.DEEPSEEK_HARNESS_MODEL ?? '').trim() || 'deepseek-v4-flash',
    maxTokens,
    apiKey: (env.DEEPSEEK_API_KEY ?? '').trim() || undefined,
    baseUrl: (env.DEEPSEEK_BASE_URL ?? '').trim() || undefined,
    requestTimeoutMs: parsePositiveInt(env.DEEPSEEK_HARNESS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    disposeGraceMs: parsePositiveInt(env.DEEPSEEK_HARNESS_KILL_MS, DEFAULT_KILL_MS),
    cordisConfig: (env.DSH_CORDIS_CONFIG ?? '').trim() || undefined,
    installMethod: parseInstallMethod(env.DEEPSEEK_HARNESS_INSTALL_METHOD),
    installCommand: (env.DEEPSEEK_HARNESS_INSTALL_COMMAND ?? '').trim() || undefined,
  };
}
