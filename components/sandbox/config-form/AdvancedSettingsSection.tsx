'use client';

import { type Control, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import type { SandboxConfigFormData } from '../config-form';
import { FormTextField } from './FormField';
import { RuntimeSelector } from './RuntimeSelector';

interface AdvancedSettingsSectionProps {
  control: Control<SandboxConfigFormData>;
  commonConfig?: {
    opencodeAuthJsonB64?: string;
    gistUrl?: string;
  };
}

export function AdvancedSettingsSection({ control, commonConfig }: AdvancedSettingsSectionProps) {
  const snapshotId = useWatch({ control, name: 'snapshotId' });
  const opencodeAuthJsonB64 = useWatch({ control, name: 'opencodeAuthJsonB64' });
  const gistUrl = useWatch({ control, name: 'gistUrl' });

  const hasCommonOpencode = !!(commonConfig?.opencodeAuthJsonB64 || opencodeAuthJsonB64);
  const hasCommonGistUrl = !!(commonConfig?.gistUrl || gistUrl);

  return (
    <div className='space-y-4 pt-4'>
      <RuntimeSelector control={control} />

      <FormTextField
        control={control}
        name='snapshotId'
        label='Snapshot ID'
        placeholder='snap_...'
        description='Create sandbox from a saved snapshot for faster startup'
      />

      {!snapshotId && (
        <FormTextField
          control={control}
          name='gistUrl'
          label='Gist URL'
          placeholder={commonConfig?.gistUrl || 'https://gist.githubusercontent.com/...'}
          description={
            hasCommonGistUrl
              ? 'Raw URL of the Gist containing the execution script (override common config if needed)'
              : 'Raw URL of the Gist containing the execution script'
          }
          badge={hasCommonGistUrl ? '(Using common config)' : undefined}
        />
      )}

      {!snapshotId && (
        <FormTextField
          control={control}
          name='frontDir'
          label='Frontend Directory'
          placeholder='(root)'
          description='Directory containing frontend code (leave empty for root)'
        />
      )}

      <FormTextField
        control={control}
        name='opencodeAuthJsonB64'
        label='OpenCode Auth JSON (Base64)'
        placeholder={hasCommonOpencode ? '••••••••' : 'eyJ...'}
        description={
          hasCommonOpencode
            ? 'Base64-encoded authentication JSON for OpenCode (leave empty to use common config)'
            : 'Base64-encoded authentication JSON for OpenCode'
        }
        className='font-mono text-sm'
        badge={hasCommonOpencode ? '(Using common config)' : undefined}
      />

      <FormField
        control={control}
        name='enableCodeReview'
        render={({ field }) => (
          <FormItem className='flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4'>
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <div className='space-y-1 leading-none'>
              <FormLabel>Enable Code Review</FormLabel>
              <FormDescription>
                Run code review step after execution (default: disabled)
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}
