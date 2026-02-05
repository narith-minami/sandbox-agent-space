'use client';

import { Settings } from 'lucide-react';
import { PresetManager } from '@/components/settings/preset-manager';
import { UserSettingsForm } from '@/components/settings/user-settings-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Settings</h1>
        <p className='text-muted-foreground'>Manage sub-options and environment presets</p>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Settings className='h-5 w-5 text-primary' />
              Sub-options
            </CardTitle>
            <CardDescription>Manage code review and OpenCode auth</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSettingsForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment presets</CardTitle>
            <CardDescription>Save Gist / Snapshot / Workdir</CardDescription>
          </CardHeader>
          <CardContent>
            <PresetManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
