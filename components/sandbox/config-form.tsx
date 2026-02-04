'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Form } from '@/components/ui/form';
import { AdvancedSettingsSection } from './config-form/AdvancedSettingsSection';
import { FormTextArea } from './config-form/FormField';
import { PlanSourceSection } from './config-form/PlanSourceSection';
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
    githubToken: z.string(),
    opencodeAuthJsonB64: z.string(),
    runtime: z.enum(['node24', 'node22', 'python3.13']),
    snapshotId: z.string().optional(),
    enableCodeReview: z.boolean(),
  })
  .refine(
    (data) => {
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
  commonConfig?: {
    githubToken?: string;
    opencodeAuthJsonB64?: string;
    gistUrl?: string;
  };
}

export function ConfigForm({
  onSubmit,
  isLoading = false,
  defaultValues,
  commonConfig,
}: ConfigFormProps) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const form = useForm<SandboxConfigFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      planSource: 'file',
      planFile: '',
      planText: '',
      repoUrl: '',
      repoSlug: '',
      baseBranch: 'main',
      memo: '',
      gistUrl: commonConfig?.gistUrl || '',
      frontDir: '',
      githubToken: commonConfig?.githubToken || '',
      opencodeAuthJsonB64: commonConfig?.opencodeAuthJsonB64 || '',
      runtime: 'node24',
      snapshotId: '',
      enableCodeReview: false,
      ...defaultValues,
    },
  });

  const selectedRuntime = form.watch('runtime');
  const snapshotId = form.watch('snapshotId');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sandbox Configuration</CardTitle>
        <CardDescription>
          Configure the coding agent sandbox with your repository settings. Powered by Vercel
          Sandbox SDK for isolated microVM execution.
          <br />
          <span className='text-sm text-muted-foreground mt-1'>
            Pull Request URLs will be automatically detected from sandbox logs.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            {/* 1. Plan Source */}
            {!snapshotId && <PlanSourceSection control={form.control} />}

            {/* 2. Repository Information */}
            {!snapshotId && <RepositorySection control={form.control} />}

            {/* 3. Memo Field */}
            <FormTextArea
              control={form.control}
              name='memo'
              label='Memo (Optional)'
              placeholder='Add notes about this sandbox session...'
              description='Optional notes or description for this sandbox session'
              rows={3}
            />

            {/* 4. Optional Advanced Settings - Collapsible */}
            <Collapsible open={showOptionalFields} onOpenChange={setShowOptionalFields}>
              <CollapsibleTrigger asChild>
                <Button type='button' variant='outline' className='w-full justify-between'>
                  <span>Advanced Settings (Optional)</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showOptionalFields ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AdvancedSettingsSection control={form.control} commonConfig={commonConfig} />
              </CollapsibleContent>
            </Collapsible>

            {/* Submit Button */}
            <div className='pt-2'>
              <Button type='submit' className='w-full' disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Starting Sandbox...
                  </>
                ) : (
                  <>
                    Start Sandbox
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
