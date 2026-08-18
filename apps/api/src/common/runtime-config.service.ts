import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { decryptSecret, encryptSecret, effectiveSecret } from './secrets';
import { loadHarnessConfig } from '@deepseek-harness/harness';

/**
 * Persistence for the agent runtime configuration (provider, model, tokens,
 * base URL, executable, args, API key). Env vars provide the defaults; values
 * saved from the Settings UI override them. The API key is encrypted at rest
 * and never returned by the API (only an `apiKeySet` flag).
 */

const PREFIX = 'harness.';

export interface RuntimeConfig {
  provider: string;
  model: string;
  maxTokens?: number;
  baseUrl?: string;
  command: string;
  args: string[];
  cordisConfig?: string;
  apiKey?: string;
}

export interface RuntimeConfigPublic {
  provider: string;
  model: string;
  maxTokens?: number;
  baseUrl?: string;
  command: string;
  args: string[];
  cordisConfig?: string;
  apiKeySet: boolean;
}

export interface RuntimeConfigUpdate {
  provider?: string;
  model?: string;
  maxTokens?: number | null;
  baseUrl?: string;
  command?: string;
  args?: string[];
  cordisConfig?: string;
  /** undefined = keep current, '' = clear, otherwise set. */
  apiKey?: string;
}

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** DB-only overrides (fields the user explicitly set via the UI). */
  private async loadOverrides(): Promise<Partial<RuntimeConfig>> {
    const rows = await this.prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
    const map = new Map(rows.map((r) => [r.key.slice(PREFIX.length), r.value]));
    const str = (k: string): string | undefined => {
      const v = map.get(k);
      return v && v.length ? v : undefined;
    };

    const out: Partial<RuntimeConfig> = {};
    const provider = str('provider');
    const model = str('model');
    const baseUrl = str('baseUrl');
    const command = str('command');
    if (provider) out.provider = provider;
    if (model) out.model = model;
    if (baseUrl) out.baseUrl = baseUrl;
    if (command) out.command = command;

    const maxTokensRaw = str('maxTokens');
    if (maxTokensRaw) {
      const n = Number.parseInt(maxTokensRaw, 10);
      if (Number.isFinite(n) && n > 0) out.maxTokens = n;
    }

    const argsRaw = str('args');
    if (argsRaw) {
      try {
        out.args = JSON.parse(argsRaw) as string[];
      } catch {
        out.args = argsRaw.split(/\s+/);
      }
    }

    const cordisConfig = str('cordisConfig');
    if (cordisConfig) out.cordisConfig = cordisConfig;

    const apiKeyRaw = str('apiKey');
    if (apiKeyRaw) {
      try {
        out.apiKey = decryptSecret(apiKeyRaw, effectiveSecret());
      } catch {
        // Corrupt / rotated secret — treat as unset rather than crash startup.
      }
    }

    return out;
  }

  /** Effective config: env defaults overlaid with DB overrides. */
  async load(): Promise<RuntimeConfig> {
    const env = loadHarnessConfig();
    const overrides = await this.loadOverrides();
    return {
      provider: overrides.provider ?? env.provider,
      model: overrides.model ?? env.model,
      maxTokens: overrides.maxTokens ?? env.maxTokens,
      baseUrl: overrides.baseUrl ?? env.baseUrl,
      command: overrides.command ?? env.command,
      args: overrides.args ?? env.args,
      cordisConfig: overrides.cordisConfig ?? env.cordisConfig,
      apiKey: overrides.apiKey ?? env.apiKey,
    };
  }

  async save(dto: RuntimeConfigUpdate): Promise<RuntimeConfig> {
    const upsert = (key: string, value: string) =>
      this.prisma.setting.upsert({
        where: { key: PREFIX + key },
        update: { value },
        create: { key: PREFIX + key, value },
      });

    if (dto.provider !== undefined) await upsert('provider', dto.provider.trim());
    if (dto.model !== undefined) await upsert('model', dto.model.trim());
    if (dto.baseUrl !== undefined) await upsert('baseUrl', dto.baseUrl.trim());
    if (dto.command !== undefined) await upsert('command', dto.command.trim());
    if (dto.args !== undefined) await upsert('args', JSON.stringify(dto.args));
    if (dto.cordisConfig !== undefined) await upsert('cordisConfig', dto.cordisConfig.trim());
    if (dto.maxTokens !== undefined) await upsert('maxTokens', dto.maxTokens === null ? '' : String(dto.maxTokens));
    if (dto.apiKey !== undefined) {
      await upsert('apiKey', dto.apiKey === '' ? '' : encryptSecret(dto.apiKey, effectiveSecret()));
    }

    return this.load();
  }

  toPublic(config: RuntimeConfig): RuntimeConfigPublic {
    return {
      provider: config.provider,
      model: config.model,
      maxTokens: config.maxTokens,
      baseUrl: config.baseUrl,
      command: config.command,
      args: config.args,
      cordisConfig: config.cordisConfig,
      apiKeySet: Boolean(config.apiKey),
    };
  }
}
