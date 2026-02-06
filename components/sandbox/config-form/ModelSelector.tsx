'use client';

import type { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ANTHROPIC_MODELS,
  type ModelConfig,
  GOOGLE_MODELS,
  OPENAI_MODELS,
} from '@/lib/constants/models';
import type { SandboxConfigFormData } from '../config-form';

interface ModelSelectorProps {
  control: Control<SandboxConfigFormData>;
  variant?: 'cards' | 'select';
}

export function ModelSelector({ control, variant = 'cards' }: ModelSelectorProps) {
  return (
    <FormField
      control={control}
      name='modelId'
      render={({ field }) => (
        <FormItem>
          <FormControl>
            {variant === 'select' ? (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder='Select model' />
                </SelectTrigger>
                <SelectContent>
                  {ANTHROPIC_MODELS.map((model) => (
                    <SelectItem key={model.modelId} value={model.modelId}>
                      {model.label}
                    </SelectItem>
                  ))}
                  {OPENAI_MODELS.map((model) => (
                    <SelectItem key={model.modelId} value={model.modelId}>
                      {model.label}
                    </SelectItem>
                  ))}
                  {GOOGLE_MODELS.map((model) => (
                    <SelectItem key={model.modelId} value={model.modelId}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className='space-y-4'>
                {/* Anthropic Models */}
                <div>
                  <div className='text-xs font-medium text-muted-foreground mb-2'>
                    Anthropic Claude
                  </div>
                  <div className='grid grid-cols-1 gap-2'>
                    {ANTHROPIC_MODELS.map((model) => (
                      <ModelButton
                        key={model.modelId}
                        model={model}
                        selected={field.value === model.modelId}
                        onClick={() => field.onChange(model.modelId)}
                      />
                    ))}
                  </div>
                </div>

                {/* OpenAI Models */}
                <div>
                  <div className='text-xs font-medium text-muted-foreground mb-2'>OpenAI GPT</div>
                  <div className='grid grid-cols-1 gap-2'>
                    {OPENAI_MODELS.map((model) => (
                      <ModelButton
                        key={model.modelId}
                        model={model}
                        selected={field.value === model.modelId}
                        onClick={() => field.onChange(model.modelId)}
                      />
                    ))}
                  </div>
                </div>

                {/* Google Models */}
                <div>
                  <div className='text-xs font-medium text-muted-foreground mb-2'>
                    Google Gemini
                  </div>
                  <div className='grid grid-cols-1 gap-2'>
                    {GOOGLE_MODELS.map((model) => (
                      <ModelButton
                        key={model.modelId}
                        model={model}
                        selected={field.value === model.modelId}
                        onClick={() => field.onChange(model.modelId)}
                      />
                    ))}
                  </div>
                </div>
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
