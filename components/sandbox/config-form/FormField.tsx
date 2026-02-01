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
import { Textarea } from '@/components/ui/textarea';
import type { SandboxConfigFormData } from '../config-form';

interface FormTextFieldProps {
  control: Control<SandboxConfigFormData>;
  name: keyof SandboxConfigFormData;
  label: string;
  placeholder?: string;
  description?: string;
  type?: 'text' | 'password';
  badge?: string;
  className?: string;
}

export function FormTextField({
  control,
  name,
  label,
  placeholder,
  description,
  type = 'text',
  badge,
  className,
}: FormTextFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {badge && <span className='ml-2 text-xs text-green-600'>{badge}</span>}
          </FormLabel>
          <FormControl>
            {className ? (
              <Textarea
                placeholder={placeholder}
                className={className}
                {...field}
                value={typeof field.value === 'boolean' ? '' : field.value}
              />
            ) : (
              <Input
                type={type}
                placeholder={placeholder}
                {...field}
                value={typeof field.value === 'boolean' ? '' : field.value}
              />
            )}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface FormTextAreaProps {
  control: Control<SandboxConfigFormData>;
  name: keyof SandboxConfigFormData;
  label: string;
  placeholder?: string;
  description?: string;
  rows?: number;
  className?: string;
  badge?: string;
}

export function FormTextArea({
  control,
  name,
  label,
  placeholder,
  description,
  rows = 3,
  className = '',
  badge,
}: FormTextAreaProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {badge && <span className='ml-2 text-xs text-green-600'>{badge}</span>}
          </FormLabel>
          <FormControl>
            <Textarea
              placeholder={placeholder}
              rows={rows}
              className={className}
              {...field}
              value={typeof field.value === 'boolean' ? '' : field.value}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
