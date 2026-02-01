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
            <FormLabel className='text-base font-semibold'>Plan Source</FormLabel>
            <FormControl>
              <Tabs
                value={field.value}
                onValueChange={(value) => field.onChange(value as 'file' | 'text')}
                className='w-full'
              >
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='file'>Use Repository File</TabsTrigger>
                  <TabsTrigger value='text'>Enter Text Directly</TabsTrigger>
                </TabsList>
                <TabsContent value='file' className='mt-4'>
                  <FormField
                    control={control}
                    name='planFile'
                    render={({ field: planField }) => (
                      <FormItem>
                        <FormLabel>Plan File Path</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='docs/plan.md'
                            {...planField}
                            value={typeof planField.value === 'boolean' ? '' : planField.value}
                          />
                        </FormControl>
                        <FormDescription>
                          Path to the plan file in your repository (e.g., docs/plan.md)
                        </FormDescription>
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
                        <FormLabel>Plan Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='Enter your plan content here in Markdown format...'
                            rows={10}
                            className='font-mono text-sm'
                            {...textField}
                            value={typeof textField.value === 'boolean' ? '' : textField.value}
                          />
                        </FormControl>
                        <FormDescription>
                          Your plan content will be saved as a Markdown file in the sandbox
                        </FormDescription>
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
