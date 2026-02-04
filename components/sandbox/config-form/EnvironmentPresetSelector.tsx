'use client';

import { useMemo } from 'react';
import type { Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EnvironmentPreset } from '@/types/sandbox';
import type { SandboxConfigFormData } from '../config-form';
import { FormTextField } from './FormField';

interface EnvironmentPresetSelectorProps {
  presets: EnvironmentPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (presetId: string | null) => void;
  control: Control<SandboxConfigFormData>;
  defaultGistUrl?: string;
}

export function EnvironmentPresetSelector({
  presets,
  selectedPresetId,
  onSelectPreset,
  control,
  defaultGistUrl,
}: EnvironmentPresetSelectorProps) {
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type='button' variant='outline' className='w-full justify-between'>
          <span>環境プリセット</span>
          <span className='text-xs text-muted-foreground'>
            {selectedPreset?.name || 'カスタム'}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>環境プリセット</DialogTitle>
          <DialogDescription>
            ここでプリセットの選択と環境オプションの編集を行います。
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <div className='text-sm font-medium'>プリセット</div>
            <Select
              value={selectedPresetId || 'custom'}
              onValueChange={(value) => onSelectPreset(value === 'custom' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder='プリセットを選択' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='custom'>カスタム</SelectItem>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-3 rounded-xl border bg-muted/30 p-4'>
            <div className='text-sm font-semibold'>Environment Options</div>
            <FormTextField
              control={control}
              name='gistUrl'
              label='Setup Script URL (Gist)'
              placeholder={defaultGistUrl || 'https://gist.githubusercontent.com/...'}
              description='Raw URL of the Gist containing setup script'
            />
            <FormTextField
              control={control}
              name='snapshotId'
              label='Snapshot ID'
              placeholder='snap_...'
              description='Start from a snapshot (optional)'
            />
            <FormTextField
              control={control}
              name='frontDir'
              label='Work Directory'
              placeholder='(root)'
              description='Working directory inside repository'
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
