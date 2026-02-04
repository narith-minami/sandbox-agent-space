'use client';

import type { Control } from 'react-hook-form';
import type { SandboxConfigFormData } from '../config-form';
import { FormTextField } from './FormField';

interface RepositorySectionProps {
  control: Control<SandboxConfigFormData>;
}

export function RepositorySection({ control }: RepositorySectionProps) {
  return (
    <div className='space-y-4 p-4 border rounded-lg bg-muted/30'>
      <h3 className='font-semibold text-sm'>Repository Information</h3>

      <FormTextField
        control={control}
        name='repoUrl'
        label='Repository URL'
        placeholder='https://github.com/owner/repo'
        description='GitHub repository URL - will be cloned using SDK git source'
        required
      />

      <FormTextField
        control={control}
        name='repoSlug'
        label='Repository Slug'
        placeholder='owner/repo'
        description='Repository identifier in owner/repo format'
        required
      />

      <FormTextField
        control={control}
        name='baseBranch'
        label='Base Branch'
        placeholder='main'
        description='Git branch to clone (default: main)'
        required
      />
    </div>
  );
}
