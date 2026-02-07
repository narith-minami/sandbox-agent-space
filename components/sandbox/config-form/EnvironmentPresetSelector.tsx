'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Control } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateEnvironmentPreset,
  useUpdateEnvironmentPreset,
} from '@/hooks/use-environment-presets';
import type { EnvironmentPreset } from '@/types/sandbox';
import type { SandboxConfigFormData } from '../config-form';
import { FormTextField } from './FormField';

interface EnvironmentPresetSelectorProps {
  presets: EnvironmentPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (presetId: string | null) => void;
  control: Control<SandboxConfigFormData>;
  defaultGistUrl?: string;
  onOpenChange?: (open: boolean) => void;
}

export function EnvironmentPresetSelector({
  presets,
  selectedPresetId,
  onSelectPreset,
  control,
  defaultGistUrl,
  onOpenChange,
}: EnvironmentPresetSelectorProps) {
  const [draftName, setDraftName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  );
  const createPreset = useCreateEnvironmentPreset();
  const updatePreset = useUpdateEnvironmentPreset();

  const gistUrl = useWatch({ control, name: 'gistUrl' });
  const snapshotId = useWatch({ control, name: 'snapshotId' });
  const frontDir = useWatch({ control, name: 'frontDir' });

  useEffect(() => {
    setDraftName(selectedPreset?.name || '');
  }, [selectedPreset]);

  const handleSave = async () => {
    const name = draftName.trim();
    if (!name) {
      toast.error('Enter a preset name');
      return;
    }

    try {
      if (selectedPresetId) {
        await updatePreset.mutateAsync({
          id: selectedPresetId,
          name,
          gistUrl: gistUrl || '',
          snapshotId: snapshotId || '',
          workdir: frontDir || '',
        });
        toast.success('Preset updated');
        setIsOpen(false);
        onOpenChange?.(false);
      } else {
        const created = await createPreset.mutateAsync({
          name,
          gistUrl: gistUrl || '',
          snapshotId: snapshotId || '',
          workdir: frontDir || '',
        });
        onSelectPreset(created.id);
        toast.success('Preset created');
        setIsOpen(false);
        onOpenChange?.(false);
      }
    } catch (error) {
      toast.error('Failed to save preset', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        onOpenChange?.(open);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='outline'
          className='w-full justify-between'
          onClick={() => setIsOpen(true)}
        >
          <span>{selectedPreset?.name || 'Environment Preset'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Environment Preset</DialogTitle>
          <DialogDescription>Select a preset and edit environment options.</DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <div className='text-sm font-medium'>Preset</div>
            <Select
              value={selectedPresetId || 'custom'}
              onValueChange={(value) => onSelectPreset(value === 'custom' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select preset' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='custom'>Custom</SelectItem>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <div className='text-sm font-medium'>Preset name</div>
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder='e.g. staging'
            />
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
          <div className='flex justify-end'>
            <Button
              type='button'
              onClick={handleSave}
              disabled={createPreset.isPending || updatePreset.isPending}
            >
              {selectedPresetId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
