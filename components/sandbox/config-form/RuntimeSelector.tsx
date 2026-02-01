'use client';

import type { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { SandboxConfigFormData } from '../config-form';

// Runtime options with descriptions
export const RUNTIME_OPTIONS = [
  { value: 'node24', label: 'Node.js 24', description: 'Latest Node.js with modern features' },
  { value: 'node22', label: 'Node.js 22 LTS', description: 'Long-term support version' },
  { value: 'python3.13', label: 'Python 3.13', description: 'Latest Python runtime' },
] as const;

export type RuntimeOption = (typeof RUNTIME_OPTIONS)[number]['value'];

interface RuntimeSelectorProps {
  control: Control<SandboxConfigFormData>;
}

export function RuntimeSelector({ control }: RuntimeSelectorProps) {
  return (
    <FormField
      control={control}
      name='runtime'
      render={({ field }) => (
        <FormItem>
          <FormLabel>Runtime Environment</FormLabel>
          <FormControl>
            <div className='grid grid-cols-3 gap-2'>
              {RUNTIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => field.onChange(option.value)}
                  className={`p-3 border rounded-lg text-left transition-all ${
                    field.value === option.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className='font-medium text-sm'>{option.label}</div>
                  <div className='text-xs text-muted-foreground mt-0.5'>{option.description}</div>
                </button>
              ))}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
