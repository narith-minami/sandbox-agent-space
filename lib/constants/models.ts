/**
 * AI model definitions for sandbox config.
 * Label format "Name (N)": N = premium request multiplier (GitHub Copilot reference).
 * @see https://docs.github.com/ja/copilot/reference/ai-models/supported-models#model-multipliers
 */
export const MODEL_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google',
} as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[keyof typeof MODEL_PROVIDERS];

export interface ModelConfig {
  providerId: string;
  modelId: string;
  label: string;
  description: string;
  tier: 'basic' | 'standard' | 'premium';
}

/** Default model ID aligned with OpenCode (anthropic/claude-sonnet-4-5). */
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-5';

export const ANTHROPIC_MODELS: readonly ModelConfig[] = [
  {
    providerId: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5 (1)',
    description: 'OpenCode default, balanced performance',
    tier: 'standard',
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-opus-4-5-20251101',
    label: 'Claude Opus 4.5 (3)',
    description: 'Most capable model',
    tier: 'premium',
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5 (0.33)',
    description: 'Fastest, most cost-effective',
    tier: 'basic',
  },
] as const;

export const OPENAI_MODELS: readonly ModelConfig[] = [
  {
    providerId: 'openai',
    modelId: 'gpt-5.3-codex',
    label: 'GPT-5.3-Codex (1)',
    description: 'Codex-optimized, latest',
    tier: 'premium',
  },
  {
    providerId: 'openai',
    modelId: 'gpt-5.2-codex',
    label: 'GPT-5.2-Codex (1)',
    description: 'Codex-optimized for coding',
    tier: 'premium',
  },
  {
    providerId: 'openai',
    modelId: 'gpt-5.2',
    label: 'GPT-5.2 (1)',
    description: 'OpenAI flagship model',
    tier: 'premium',
  },
  {
    providerId: 'openai',
    modelId: 'gpt-5-mini',
    label: 'GPT-5 mini (0)',
    description: 'Fast and cost-effective',
    tier: 'standard',
  },
] as const;

export const GOOGLE_MODELS: readonly ModelConfig[] = [
  {
    providerId: 'google',
    modelId: 'gemini-3-pro',
    label: 'Gemini 3 Pro (1)',
    description: 'Google flagship, public preview',
    tier: 'premium',
  },
  {
    providerId: 'google',
    modelId: 'gemini-3-flash',
    label: 'Gemini 3 Flash (0.33)',
    description: 'Fast and cost-effective, public preview',
    tier: 'standard',
  },
] as const;

export const ALL_MODELS = [...ANTHROPIC_MODELS, ...OPENAI_MODELS, ...GOOGLE_MODELS] as const;

export function findModelById(modelId: string): ModelConfig | undefined {
  return ALL_MODELS.find((model) => model.modelId === modelId);
}

export function getModelProvider(modelId: string): string | undefined {
  const model = findModelById(modelId);
  return model?.providerId;
}
