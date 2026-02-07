'use client';

import type { Control } from 'react-hook-form';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConnectedProvider } from '@/hooks/use-model-options';
import { ALL_MODELS, type ModelConfig } from '@/lib/constants/models';
import type { SandboxConfigFormData } from '../config-form';

interface ModelSelectorProps {
  control: Control<SandboxConfigFormData>;
  models?: readonly ModelConfig[];
  providers?: ConnectedProvider[];
  isLoading?: boolean;
  variant?: 'cards' | 'select';
}

function getProviderLabel(providerId: string, providers?: ConnectedProvider[]): string {
  const fromApi = providers?.find((provider) => provider.id === providerId)?.name;
  if (fromApi) return fromApi;

  if (providerId === 'anthropic') return 'Anthropic Claude';
  if (providerId === 'openai') return 'OpenAI GPT';
  if (providerId === 'google') return 'Google Gemini';
  if (providerId === 'github-copilot') return 'GitHub Copilot';

  return providerId;
}

function buildProviderGroups(models: readonly ModelConfig[]) {
  const grouped = new Map<string, ModelConfig[]>();

  for (const model of models) {
    const existing = grouped.get(model.providerId) || [];
    existing.push(model);
    grouped.set(model.providerId, existing);
  }

  return Array.from(grouped.entries()).map(([providerId, providerModels]) => ({
    providerId,
    models: providerModels,
  }));
}

function toSelectValue(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

function fromSelectValue(value: string): { providerId: string; modelId: string } {
  const [providerId, ...modelIdParts] = value.split('::');
  return {
    providerId,
    modelId: modelIdParts.join('::'),
  };
}

export function ModelSelector({
  control,
  models,
  providers,
  isLoading = false,
  variant = 'cards',
}: ModelSelectorProps) {
  const form = useFormContext<SandboxConfigFormData>();
  const currentProviderId = useWatch({ control, name: 'modelProvider' });
  const resolvedModels = models ?? ALL_MODELS;
  const providerGroups = buildProviderGroups(resolvedModels);

  return (
    <FormField
      control={control}
      name='modelId'
      render={({ field }) => (
        <FormItem>
          <FormControl>
            {variant === 'select' ? (
              <Select
                value={
                  resolvedModels.some(
                    (model) =>
                      model.modelId === field.value &&
                      (!currentProviderId || model.providerId === currentProviderId)
                  )
                    ? toSelectValue(
                        currentProviderId ||
                          resolvedModels.find((model) => model.modelId === field.value)
                            ?.providerId ||
                          '',
                        field.value
                      )
                    : undefined
                }
                onValueChange={(value) => {
                  const selected = fromSelectValue(value);
                  field.onChange(selected.modelId);
                  form.setValue('modelProvider', selected.providerId);
                }}
                disabled={isLoading}
              >
                <SelectTrigger aria-busy={isLoading}>
                  <SelectValue placeholder='Select model' />
                </SelectTrigger>
                <SelectContent>
                  {isLoading && (
                    <SelectItem value='__loading__' disabled>
                      Loading models...
                    </SelectItem>
                  )}
                  {!isLoading && resolvedModels.length === 0 && (
                    <SelectItem value='__empty__' disabled>
                      No models available for connected providers
                    </SelectItem>
                  )}
                  {!isLoading &&
                    providerGroups.map((group, index) => (
                      <SelectGroup key={group.providerId}>
                        {index > 0 && <SelectSeparator />}
                        <SelectLabel>{getProviderLabel(group.providerId, providers)}</SelectLabel>
                        {group.models.map((model) => (
                          <SelectItem
                            key={`${model.providerId}:${model.modelId}`}
                            value={toSelectValue(model.providerId, model.modelId)}
                          >
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className='space-y-4'>
                {providerGroups.length === 0 && (
                  <div className='text-xs text-muted-foreground'>
                    No models available for connected providers.
                  </div>
                )}
                {providerGroups.map((group) => (
                  <div key={group.providerId}>
                    <div className='text-xs font-medium text-muted-foreground mb-2'>
                      {getProviderLabel(group.providerId, providers)}
                    </div>
                    <div className='grid grid-cols-1 gap-2'>
                      {group.models.map((model) => (
                        <ModelButton
                          key={`${model.providerId}:${model.modelId}`}
                          model={model}
                          selected={
                            field.value === model.modelId &&
                            (!currentProviderId || currentProviderId === model.providerId)
                          }
                          onClick={() => {
                            field.onChange(model.modelId);
                            form.setValue('modelProvider', model.providerId);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface ModelButtonProps {
  model: ModelConfig;
  selected: boolean;
  onClick: () => void;
}

function ModelButton({ model, selected, onClick }: ModelButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`p-3 border rounded-lg text-left transition-all ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className='flex items-center justify-between'>
        <div className='font-medium text-sm'>{model.label}</div>
        <TierBadge tier={model.tier} />
      </div>
      <div className='text-xs text-muted-foreground mt-0.5'>{model.description}</div>
    </button>
  );
}

interface TierBadgeProps {
  tier: 'basic' | 'standard' | 'premium';
}

function TierBadge({ tier }: TierBadgeProps) {
  const colors = {
    basic: 'bg-green-500/10 text-green-500',
    standard: 'bg-blue-500/10 text-blue-500',
    premium: 'bg-purple-500/10 text-purple-500',
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  return <span className={`text-xs px-2 py-0.5 rounded ${colors[tier]}`}>{capitalize(tier)}</span>;
}
