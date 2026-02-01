import { ArrowRight, Code2, History, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className='space-y-8'>
      {/* Hero Section */}
      <section className='text-center space-y-4 py-12'>
        <h1 className='text-4xl font-bold tracking-tight'>Coding Agent Sandbox</h1>
        <p className='text-xl text-muted-foreground max-w-2xl mx-auto'>
          ブラウザからVercel
          Sandboxを実行し、GitHubリポジトリに対してコーディングエージェントを動かすWebアプリケーション
        </p>
        <div className='flex justify-center gap-4 pt-4'>
          <Link href='/sandbox'>
            <Button size='lg'>
              <Zap className='mr-2 h-5 w-5' />
              Start Sandbox
            </Button>
          </Link>
          <Link href='/history'>
            <Button size='lg' variant='outline'>
              <History className='mr-2 h-5 w-5' />
              View History
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className='grid md:grid-cols-3 gap-6 py-8'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Code2 className='h-5 w-5' />
              GitHub Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              GitHubリポジトリと連携し、コーディングエージェントが自動的にコードを生成・修正します。
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Zap className='h-5 w-5' />
              Real-time Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Server-Sent Eventsを使用して、リアルタイムでログをストリーミング表示します。
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <History className='h-5 w-5' />
              Session History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              過去の実行履歴を保存し、いつでも確認・再実行が可能です。
            </CardDescription>
          </CardContent>
        </Card>
      </section>

      {/* Getting Started */}
      <section className='py-8'>
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>以下の手順でコーディングエージェントを実行できます</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-start gap-4'>
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold'>
                1
              </div>
              <div>
                <h3 className='font-medium'>設定を準備</h3>
                <p className='text-sm text-muted-foreground'>
                  Gist URL、GitHubリポジトリ、認証トークンを準備します
                </p>
              </div>
            </div>
            <div className='flex items-start gap-4'>
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold'>
                2
              </div>
              <div>
                <h3 className='font-medium'>Sandboxを起動</h3>
                <p className='text-sm text-muted-foreground'>設定を入力してSandboxを起動します</p>
              </div>
            </div>
            <div className='flex items-start gap-4'>
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold'>
                3
              </div>
              <div>
                <h3 className='font-medium'>リアルタイムで監視</h3>
                <p className='text-sm text-muted-foreground'>
                  ログをリアルタイムで確認し、完了を待ちます
                </p>
              </div>
            </div>
            <div className='pt-4'>
              <Link href='/sandbox'>
                <Button>
                  今すぐ始める
                  <ArrowRight className='ml-2 h-4 w-4' />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
