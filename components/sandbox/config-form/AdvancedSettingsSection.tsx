'use client';

import type { Control } from 'react-hook-form';
import type { SandboxConfigFormData } from '../config-form';
import { RuntimeSelector } from './RuntimeSelector';

interface AdvancedSettingsSectionProps {
  control: Control<SandboxConfigFormData>;
}

export function AdvancedSettingsSection({ control }: AdvancedSettingsSectionProps) {
  return (
    <div className='space-y-4 pt-4'>
      <RuntimeSelector control={control} />
    </div>
  );
}
