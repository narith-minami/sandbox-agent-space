'use client';

import { Card, CardContent } from '@/components/ui/card';

interface EmptySessionStateProps {
  isCloning: boolean;
}

/**
 * EmptySessionState - Displays empty state when no session is active
 */
export function EmptySessionState({ isCloning }: EmptySessionStateProps) {
  return (
    <Card>
      <CardContent className='flex items-center justify-center h-[400px] text-muted-foreground'>
        <div className='text-center space-y-2'>
          <p>No active session</p>
          <p className='text-sm'>
            {isCloning
              ? 'Enter your credentials to clone and start the sandbox'
              : 'Configure and start a sandbox to see logs'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
