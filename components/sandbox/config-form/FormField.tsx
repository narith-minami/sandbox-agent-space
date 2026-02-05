'use client';

import { Mic, MicOff } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import type { Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
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
  required?: boolean;
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
  required = false,
}: FormTextFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && <span className='ml-1 text-red-500'>*</span>}
            {badge && <span className='ml-2 text-xs text-green-600'>{badge}</span>}
          </FormLabel>
          <FormControl>
            {className ? (
              <Textarea
                placeholder={placeholder}
                className={`${className} ${fieldState.error ? 'bg-red-50 border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                {...field}
                value={typeof field.value === 'boolean' ? '' : field.value}
              />
            ) : (
              <Input
                type={type}
                placeholder={placeholder}
                className={
                  fieldState.error
                    ? 'bg-red-50 border-red-300 focus:border-red-500 focus:ring-red-500'
                    : ''
                }
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
  required?: boolean;
  enableVoiceInput?: boolean;
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
  required = false,
  enableVoiceInput = false,
}: FormTextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number>(0);

  const { isListening, isSupported, transcript, toggleListening, resetTranscript, error } =
    useSpeechRecognition({
      lang: 'ja-JP',
      interimResults: true,
    });

  // Callback to append transcript to field
  const appendTranscript = useCallback(
    (currentValue: string, newTranscript: string, onChange: (value: string) => void) => {
      if (!newTranscript) return;

      const position = cursorPositionRef.current;
      const before = currentValue.slice(0, position);
      const after = currentValue.slice(position);

      // Add space if needed
      const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
      const separator = needsSpace ? ' ' : '';

      const newValue = before + separator + newTranscript + after;
      onChange(newValue);

      // Update cursor position for next input
      cursorPositionRef.current = position + separator.length + newTranscript.length;
    },
    []
  );

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        // Handle transcript updates when listening stops
        const TranscriptHandler = () => {
          const prevTranscriptRef = useRef('');

          useEffect(() => {
            if (!isListening && transcript && transcript !== prevTranscriptRef.current) {
              appendTranscript(
                typeof field.value === 'string' ? field.value : '',
                transcript,
                field.onChange
              );
              prevTranscriptRef.current = transcript;
              resetTranscript();
            }
          }, []);

          return null;
        };

        return (
          <FormItem>
            <div className='flex items-center justify-between'>
              <FormLabel>
                {label}
                {required && <span className='ml-1 text-red-500'>*</span>}
                {badge && <span className='ml-2 text-xs text-green-600'>{badge}</span>}
              </FormLabel>
              {enableVoiceInput && isSupported && (
                <Button
                  type='button'
                  variant={isListening ? 'destructive' : 'outline'}
                  size='icon-sm'
                  onClick={toggleListening}
                  title={isListening ? 'Stop voice input' : 'Start voice input'}
                  className='shrink-0'
                >
                  {isListening ? <MicOff className='size-4' /> : <Mic className='size-4' />}
                </Button>
              )}
            </div>
            <FormControl>
              <div className='relative'>
                <Textarea
                  placeholder={placeholder}
                  rows={rows}
                  className={`${className} ${fieldState.error ? 'bg-red-50 border-red-300 focus:border-red-500 focus:ring-red-500' : ''} ${isListening ? 'ring-2 ring-red-400 ring-opacity-50' : ''}`}
                  {...field}
                  ref={(node) => {
                    // Merge refs: update both the field ref and our local ref
                    field.ref(node);
                    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
                      node;
                  }}
                  value={typeof field.value === 'boolean' ? '' : field.value}
                  onSelect={(e) => {
                    cursorPositionRef.current = e.currentTarget.selectionStart;
                  }}
                  onClick={(e) => {
                    cursorPositionRef.current = e.currentTarget.selectionStart;
                  }}
                  onKeyUp={(e) => {
                    cursorPositionRef.current = e.currentTarget.selectionStart;
                  }}
                />
                {isListening && (
                  <div className='absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-red-600 bg-white/90 dark:bg-gray-900/90 px-2 py-1 rounded-md'>
                    <span className='size-2 bg-red-500 rounded-full animate-pulse' />
                    Listening...
                  </div>
                )}
              </div>
            </FormControl>
            {enableVoiceInput && isListening && transcript && (
              <div className='text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mt-1'>
                <span className='font-medium'>Interim: </span>
                {transcript}
              </div>
            )}
            {enableVoiceInput && error && <div className='text-sm text-destructive'>{error}</div>}
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
            <TranscriptHandler />
          </FormItem>
        );
      }}
    />
  );
}
