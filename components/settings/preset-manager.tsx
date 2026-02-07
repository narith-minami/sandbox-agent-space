'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  useCreateEnvironmentPreset,
  useDeleteEnvironmentPreset,
  useEnvironmentPresets,
  useUpdateEnvironmentPreset,
} from '@/hooks/use-environment-presets';

const formSchema = z.object({
  name: z.string().min(1, 'Required'),
  gistUrl: z.string(),
  snapshotId: z.string(),
  workdir: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function PresetManager() {
  const { data, isLoading } = useEnvironmentPresets();
  const createPreset = useCreateEnvironmentPreset();
  const updatePreset = useUpdateEnvironmentPreset();
  const deletePreset = useDeleteEnvironmentPreset();
  const [editingId, setEditingId] = useState<string | null>(null);

  const presets = useMemo(() => data?.presets || [], [data]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      gistUrl: '',
      snapshotId: '',
      workdir: '',
    },
  });

  const handleEdit = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    setEditingId(presetId);
    form.reset({
      name: preset.name,
      gistUrl: preset.gistUrl || '',
      snapshotId: preset.snapshotId || '',
      workdir: preset.workdir || '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    form.reset({
      name: '',
      gistUrl: '',
      snapshotId: '',
      workdir: '',
    });
  };

  const handleSubmit = async (values: FormValues) => {
    try {
      if (editingId) {
        await updatePreset.mutateAsync({
          id: editingId,
          name: values.name,
          gistUrl: values.gistUrl || '',
          snapshotId: values.snapshotId || '',
          workdir: values.workdir || '',
        });
        toast.success('Preset updated');
      } else {
        await createPreset.mutateAsync({
          name: values.name,
          gistUrl: values.gistUrl || '',
          snapshotId: values.snapshotId || '',
          workdir: values.workdir || '',
        });
        toast.success('Preset created');
      }
      handleCancel();
    } catch (error) {
      toast.error('Failed to save preset', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleDelete = async (presetId: string) => {
    try {
      await deletePreset.mutateAsync(presetId);
      toast.success('Preset deleted');
    } catch (error) {
      toast.error('Failed to delete preset', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className='space-y-6'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preset name</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g. staging' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='gistUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setup Script URL</FormLabel>
                  <FormControl>
                    <Input placeholder='https://gist.githubusercontent.com/...' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='snapshotId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Snapshot ID</FormLabel>
                  <FormControl>
                    <Input placeholder='snap_...' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='workdir'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Directory</FormLabel>
                  <FormControl>
                    <Input placeholder='(root)' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button type='submit' disabled={createPreset.isPending || updatePreset.isPending}>
              {editingId ? 'Update' : 'Create'}
            </Button>
            {editingId ? (
              <Button type='button' variant='ghost' onClick={handleCancel}>
                <X className='mr-1 h-4 w-4' />
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Form>

      <div className='grid gap-3'>
        {isLoading ? (
          <div className='text-sm text-muted-foreground'>Loading...</div>
        ) : presets.length === 0 ? (
          <div className='text-sm text-muted-foreground'>No presets yet</div>
        ) : (
          presets.map((preset) => (
            <Card key={preset.id}>
              <CardContent className='flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between'>
                <div>
                  <div className='font-medium'>{preset.name}</div>
                  <div className='text-xs text-muted-foreground mt-1 break-all'>
                    Gist: {preset.gistUrl || 'Not set'} / Snapshot: {preset.snapshotId || 'Not set'}{' '}
                    / Workdir: {preset.workdir || 'root'}
                  </div>
                </div>
                <div className='flex gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => handleEdit(preset.id)}
                  >
                    <Pencil className='mr-1 h-4 w-4' />
                    Edit
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='text-destructive'
                    onClick={() => handleDelete(preset.id)}
                    disabled={deletePreset.isPending}
                  >
                    <Trash2 className='mr-1 h-4 w-4' />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
