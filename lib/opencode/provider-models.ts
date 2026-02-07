import { createOpencode, type Auth as OpencodeAuth } from '@opencode-ai/sdk';
import type { ModelConfig } from '@/lib/constants/models';

interface ProviderRecord {
  id: string;
  name: string;
  connected: boolean;
  isDefault: boolean;
}

interface DebugInfo {
  sourceModule: string;
  connectedProviderIds: string[];
  providerModelCounts: Record<string, number>;
}

export interface OpencodeModelsResponse {
  providers: ProviderRecord[];
  models: ModelConfig[];
  source: 'sdk';
  debug: DebugInfo;
}

const PROVIDER_ALIASES: Record<string, string> = {
  copilot: 'github-copilot',
  githubcopilot: 'github-copilot',
  'github-copilot': 'github-copilot',
  'github/copilot': 'github-copilot',
};

function normalizeProviderId(raw: string): string {
  const normalized = raw.trim().toLowerCase().replaceAll('_', '-');
  return PROVIDER_ALIASES[normalized] || normalized;
}

function toTier(modelId: string, modelName: string): ModelConfig['tier'] {
  const value = `${modelId} ${modelName}`.toLowerCase();

  if (value.includes('opus') || value.includes('max')) {
    return 'premium';
  }

  if (value.includes('mini') || value.includes('haiku') || value.includes('flash')) {
    return 'basic';
  }

  return 'standard';
}

function toModelConfig(
  providerId: string,
  providerName: string,
  model: { id: string; name: string }
): ModelConfig {
  const modelId = model.id;
  const label = model.name || model.id;

  return {
    providerId,
    modelId,
    label,
    description: `${providerName} model`,
    tier: toTier(modelId, label),
  };
}

function dedupeModels(models: readonly ModelConfig[]): ModelConfig[] {
  const map = new Map<string, ModelConfig>();

  for (const model of models) {
    map.set(`${model.providerId}:${model.modelId}`, model);
  }

  return Array.from(map.values());
}

function providerModelCounts(models: readonly ModelConfig[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const model of models) {
    counts[model.providerId] = (counts[model.providerId] || 0) + 1;
  }

  return counts;
}

function decodeAuthMap(opencodeAuthJsonB64?: string): Record<string, OpencodeAuth> {
  if (!opencodeAuthJsonB64) {
    return {};
  }

  try {
    const decoded = Buffer.from(opencodeAuthJsonB64, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .filter(([, value]) => value && typeof value === 'object')
      .map(([providerId, auth]) => [normalizeProviderId(providerId), auth as OpencodeAuth]);

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

async function applyAuthOverrides(
  authMap: Record<string, OpencodeAuth>,
  setAuth: (providerId: string, auth: OpencodeAuth) => Promise<unknown>
): Promise<void> {
  const entries = Object.entries(authMap);

  await Promise.allSettled(entries.map(([providerId, auth]) => setAuth(providerId, auth)));
}

export async function getConnectedProviderModels(
  opencodeAuthJsonB64?: string
): Promise<OpencodeModelsResponse> {
  const { client, server } = await createOpencode();

  try {
    const authMap = decodeAuthMap(opencodeAuthJsonB64);
    if (Object.keys(authMap).length > 0) {
      await applyAuthOverrides(authMap, (providerId, auth) => {
        return client.auth.set({
          path: { id: providerId },
          body: auth,
        });
      });
    }

    const providerListResponse = await client.provider.list({
      query: { directory: process.cwd() },
    });

    const providerData = providerListResponse.data;
    const allProviders = providerData?.all || [];
    const connectedProviderIds = new Set((providerData?.connected || []).map(normalizeProviderId));

    const providers: ProviderRecord[] = allProviders
      .map((provider) => {
        const providerId = normalizeProviderId(provider.id);

        return {
          id: providerId,
          name: provider.name,
          connected: connectedProviderIds.has(providerId),
          isDefault: Boolean(providerData?.default?.[providerId]),
        };
      })
      .filter((provider) => provider.connected);

    const models = dedupeModels(
      allProviders.flatMap((provider) => {
        const providerId = normalizeProviderId(provider.id);
        if (!connectedProviderIds.has(providerId)) {
          return [];
        }

        return Object.values(provider.models || {}).map((model) =>
          toModelConfig(providerId, provider.name, model)
        );
      })
    );

    return {
      providers,
      models,
      source: 'sdk',
      debug: {
        sourceModule: '@opencode-ai/sdk',
        connectedProviderIds: Array.from(connectedProviderIds),
        providerModelCounts: providerModelCounts(models),
      },
    };
  } finally {
    server.close();
  }
}
