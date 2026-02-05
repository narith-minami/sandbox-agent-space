'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateUserSettings, useUserSettings } from '@/hooks/use-user-settings';

const formSchema = z.object({
  opencodeAuthJsonB64: z.string(),
  enableCodeReview: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function UserSettingsForm() {
  const { data, isLoading } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      opencodeAuthJsonB64: '',
      enableCodeReview: false,
    },
  });

  useEffect(() => {
    if (!data?.settings) return;
    form.reset({
      opencodeAuthJsonB64: data.settings.opencodeAuthJsonB64 || '',
      enableCodeReview: data.settings.enableCodeReview ?? false,
    });
  }, [data, form]);

  const handleSubmit = async (values: FormValues) => {
    try {
      await updateSettings.mutateAsync({
        opencodeAuthJsonB64: values.opencodeAuthJsonB64 || '',
        enableCodeReview: values.enableCodeReview,
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='opencodeAuthJsonB64'
          render={({ field }) => (
            <FormItem>
              <FormLabel>OpenCode Auth JSON (Base64)</FormLabel>
              <FormControl>
                <Textarea className='font-mono text-sm' placeholder='eyJ...' rows={4} {...field} />
              </FormControl>
              <FormDescription>
                Enter Base64 JSON for authentication (leave empty if env var is set)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='enableCodeReview'
          render={({ field }) => (
            <FormItem className='flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4'>
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className='space-y-1 leading-none'>
                <FormLabel>Enable code review</FormLabel>
                <FormDescription>
                  Run an additional code review after execution (default: off)
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type='submit' disabled={isLoading || updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving...' : 'Save settings'}
        </Button>
      </form>
    </Form>
  );
}
