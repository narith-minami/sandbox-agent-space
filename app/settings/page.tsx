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
        <p className='text-muted-foreground'>サブオプションと環境プリセットを管理します</p>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Settings className='h-5 w-5 text-primary' />
              サブオプション
            </CardTitle>
            <CardDescription>Code review と OpenCode 認証を管理します</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSettingsForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>環境プリセット</CardTitle>
            <CardDescription>Gist / Snapshot / Workdir を保存できます</CardDescription>
          </CardHeader>
          <CardContent>
            <PresetManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
