export const MODEL_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
} as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[keyof typeof MODEL_PROVIDERS];

export interface ModelConfig {
  providerId: string;
  modelId: string;
  label: string;
  description: string;
  tier: 'basic' | 'standard' | 'premium';
}

export const ANTHROPIC_MODELS: readonly ModelConfig[] = [
  {
    providerId: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    description: 'Fast, balanced performance',
    tier: 'standard',
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-opus-4-5-20251101',
    label: 'Claude Opus 4.5',
    description: 'Most capable model',
    tier: 'premium',
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    description: 'Fastest, most cost-effective',
    tier: 'basic',
  },
] as const;

export const OPENAI_MODELS: readonly ModelConfig[] = [
  {
    providerId: 'openai',
    modelId: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'OpenAI most capable',
    tier: 'premium',
  },
  {
    providerId: 'openai',
    modelId: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Optimized for speed',
    tier: 'standard',
  },
  {
    providerId: 'openai',
    modelId: 'gpt-3.5-turbo',
    label: 'GPT-3.5 Turbo',
    description: 'Fast and cost-effective',
    tier: 'basic',
  },
] as const;

export const ALL_MODELS = [...ANTHROPIC_MODELS, ...OPENAI_MODELS] as const;

export function findModelById(modelId: string): ModelConfig | undefined {
  return ALL_MODELS.find((model) => model.modelId === modelId);
}

export function getModelProvider(modelId: string): string | undefined {
  const model = findModelById(modelId);
  return model?.providerId;
}
