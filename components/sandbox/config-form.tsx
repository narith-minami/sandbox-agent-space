'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { getModelProvider } from '@/lib/constants/models';
import { saveLastUsedValues } from '@/lib/storage';
import type { EnvironmentPreset, UserSettings } from '@/types/sandbox';
import { EnvironmentPresetSelector } from './config-form/EnvironmentPresetSelector';
import { FormTextArea } from './config-form/FormField';
import { ModelSelector } from './config-form/ModelSelector';
import { RepositorySection } from './config-form/RepositorySection';
import { RUNTIME_OPTIONS } from './config-form/RuntimeSelector';

// Form schema for react-hook-form
const formSchema = z
  .object({
    planSource: z.enum(['file', 'text']),
    planFile: z.string(),
    planText: z.string(),
    repoUrl: z.string().min(1, 'Repository URL is required'),
    repoSlug: z.string().min(1, 'Repository slug is required'),
    baseBranch: z.string().min(1, 'Base branch is required'),
    memo: z.string().optional(),
    gistUrl: z.string(),
    frontDir: z.string(),
    opencodeAuthJsonB64: z.string(),
    runtime: z.enum(['node24', 'node22', 'python3.13']),
    modelProvider: z.string(),
    modelId: z.string(),
    snapshotId: z.string().optional(),
    enableCodeReview: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.snapshotId && data.snapshotId.length > 0) {
        return true;
      }
      // Validate that either planFile or planText is provided based on planSource
      if (data.planSource === 'file') {
        return data.planFile && data.planFile.length > 0;
      }
      return data.planText && data.planText.length > 0;
    },
    {
      message: 'Plan is required (either file path or text content)',
      path: ['planFile'],
    }
  );

export type SandboxConfigFormData = z.infer<typeof formSchema>;

interface ConfigFormProps {
  onSubmit: (data: SandboxConfigFormData) => void;
  isLoading?: boolean;
  defaultValues?: Partial<SandboxConfigFormData>;
  defaultPresetId?: string | null;
  commonConfig?: {
    opencodeAuthJsonB64?: string;
    gistUrl?: string;
  };
  userSettings?: UserSettings | null;
  presets?: EnvironmentPreset[];
}

export function ConfigForm({
  onSubmit,
  isLoading = false,
  defaultValues,
  defaultPresetId,
  commonConfig,
  userSettings,
  presets = [],
}: ConfigFormProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(defaultPresetId || null);

  const form = useForm<SandboxConfigFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      planSource: 'text',
      planFile: '',
      planText: '',
      repoUrl: '',
      repoSlug: '',
      baseBranch: 'main',
      memo: '',
      gistUrl: commonConfig?.gistUrl || '',
      frontDir: '',
      opencodeAuthJsonB64:
        userSettings?.opencodeAuthJsonB64 || commonConfig?.opencodeAuthJsonB64 || '',
      runtime: 'node24',
      modelProvider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      snapshotId: '',
      enableCodeReview: userSettings?.enableCodeReview ?? false,
      ...defaultValues,
    },
  });

  const selectedRuntime = form.watch('runtime');
  const modelId = form.watch('modelId');

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  );

  // Sync modelProvider when modelId changes
  useEffect(() => {
    if (modelId) {
      const provider = getModelProvider(modelId);
      if (provider && provider !== form.getValues('modelProvider')) {
        form.setValue('modelProvider', provider);
      }
    }
  }, [modelId, form]);

  useEffect(() => {
    if (form.getValues('planSource') !== 'text') {
      form.setValue('planSource', 'text');
    }
    if (form.getValues('planFile')) {
      form.setValue('planFile', '');
    }
  }, [form]);

  useEffect(() => {
    if (!selectedPreset) return;
    form.setValue('gistUrl', selectedPreset.gistUrl || '');
    form.setValue('snapshotId', selectedPreset.snapshotId || '');
    form.setValue('frontDir', selectedPreset.workdir || '');
  }, [form, selectedPreset]);

  useEffect(() => {
    if (defaultPresetId === undefined) return;
    setSelectedPresetId(defaultPresetId || null);
  }, [defaultPresetId]);

  useEffect(() => {
    if (defaultPresetId === undefined && selectedPresetId === null) return;
    saveLastUsedValues({ presetId: selectedPresetId });
  }, [defaultPresetId, selectedPresetId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Sparkles className='h-5 w-5 text-primary' />
          Create Sandbox
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
            <div className='grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]'>
              <div className='min-w-0 lg:col-span-1'>
                <RepositorySection control={form.control} setValue={form.setValue} compact />
              </div>
              <div className='min-w-0'>
                <ModelSelector control={form.control} variant='select' />
              </div>
              <div className='min-w-0'>
                <EnvironmentPresetSelector
                  presets={presets}
                  selectedPresetId={selectedPresetId}
                  onSelectPreset={setSelectedPresetId}
                  control={form.control}
                  defaultGistUrl={commonConfig?.gistUrl}
                />
              </div>
            </div>

            <FormTextArea
              control={form.control}
              name='planText'
              label='Task'
              placeholder='Describe what you want done, task details, expected output...'
              description='Saved as Markdown inside the sandbox'
              rows={18}
              className='min-h-[320px]'
              enableVoiceInput
            />

            <input type='hidden' {...form.register('modelProvider')} />
            <input type='hidden' {...form.register('planSource')} />
            <input type='hidden' {...form.register('planFile')} />
            <input type='hidden' {...form.register('opencodeAuthJsonB64')} />
            <input type='hidden' {...form.register('enableCodeReview')} />

            <div className='pt-2'>
              <Button type='submit' className='w-full' disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Starting Sandbox...
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center">Start <ArrowUp className="ml-1 h-4 w-4" /></span>
                    {selectedRuntime && (
                      <span className='ml-2 text-xs opacity-75'>
                        ({RUNTIME_OPTIONS.find((r) => r.value === selectedRuntime)?.label})
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>

            <p className='text-xs text-muted-foreground text-center'>
              Sandbox will run in an isolated Linux microVM on Vercel infrastructure
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
