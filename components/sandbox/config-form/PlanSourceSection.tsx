'use client';

import type { Control } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { SandboxConfigFormData } from '../config-form';

interface PlanSourceSectionProps {
  control: Control<SandboxConfigFormData>;
}

export function PlanSourceSection({ control }: PlanSourceSectionProps) {
  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='planSource'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-base font-semibold'>Task input</FormLabel>
            <FormControl>
              <Tabs
                value={field.value}
                onValueChange={(value) => field.onChange(value as 'file' | 'text')}
                className='w-full'
              >
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='file'>Repository file</TabsTrigger>
                  <TabsTrigger value='text'>Text input</TabsTrigger>
                </TabsList>
                <TabsContent value='file' className='mt-4'>
                  <FormField
                    control={control}
                    name='planFile'
                    render={({ field: planField }) => (
                      <FormItem>
                        <FormLabel>
                          Plan File Path <span className='text-red-500'>*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='docs/plan.md'
                            {...planField}
                            value={typeof planField.value === 'boolean' ? '' : planField.value}
                          />
                        </FormControl>
                        <FormDescription>Plan file path in repository</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                <TabsContent value='text' className='mt-4'>
                  <FormField
                    control={control}
                    name='planText'
                    render={({ field: textField }) => (
                      <FormItem>
                        <FormLabel>
                          Plan Text <span className='text-red-500'>*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='Describe what you want done, task details, expected output...'
                            rows={12}
                            className='font-mono text-sm min-h-[240px]'
                            {...textField}
                            value={typeof textField.value === 'boolean' ? '' : textField.value}
                          />
                        </FormControl>
                        <FormDescription>Saved as Markdown inside the sandbox</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
