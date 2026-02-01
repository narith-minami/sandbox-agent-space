ブラウザベースのコーディングエージェントシステムの設計を提案します。

## システム概要

Vercel Sandboxをブラウザから実行し、GitHubリポジトリに対してコーディングエージェントを動かすWebアプリケーションです。

## アーキテクチャ設計

### 1. 技術スタック

```
Frontend:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Query (状態管理・API通信)
- WebSocket/Server-Sent Events (リアルタイム通信)

Backend:
- Next.js API Routes
- Vercel Serverless Functions
- Vercel KV (セッション管理)
- Vercel Blob (ログ保存)

External Services:
- Vercel Sandbox API
- GitHub API
- Claude API (コーディングエージェント)
```

### 2. システム構成図

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Frontend)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Config Form  │  │ Task Monitor │  │ Log Viewer│ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└────────────┬────────────────────────────────────────┘
             │ HTTPS/WebSocket
             │
┌────────────▼────────────────────────────────────────┐
│              Next.js API Routes                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ /api/sandbox │  │ /api/status  │  │ /api/logs │ │
│  │ /create      │  │              │  │           │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└────────────┬────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼──────┐    ┌────▼─────────┐
│ Vercel   │    │ GitHub API   │
│ Sandbox  │    │              │
│ API      │    └──────────────┘
└──────────┘
```

### 3. データフロー

```typescript
// 実行フロー
1. ユーザーが設定を入力
   ↓
2. Frontend → API Routes: POST /api/sandbox/create
   ↓
3. API Routes:
   - 環境変数の検証
   - Vercel Sandbox API呼び出し
   - セッションIDを生成・保存
   ↓
4. Sandbox内でスクリプト実行
   ↓
5. リアルタイムログをSSEで送信
   ↓
6. Frontend: ログ表示・進捗更新
```

## 詳細設計

### 1. データモデル

```typescript
// types/sandbox.ts
export interface SandboxConfig {
  gistUrl: string;
  repoUrl: string;
  repoSlug: string;
  frontDir: string;
  planFile: string;
  githubToken: string;
  opencodeAuthJsonB64: string;
}

export interface SandboxSession {
  id: string;
  config: SandboxConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sandboxId?: string;
  createdAt: Date;
  updatedAt: Date;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'error' | 'debug';
  message: string;
}
```

### 2. API設計

```typescript
// app/api/sandbox/create/route.ts
export async function POST(req: Request) {
  const config: SandboxConfig = await req.json();
  
  // 1. バリデーション
  validateConfig(config);
  
  // 2. セッション作成
  const session = await createSession(config);
  
  // 3. Vercel Sandbox起動
  const sandboxId = await startSandbox({
    env: {
      GITHUB_TOKEN: config.githubToken,
      OPENCODE_AUTH_JSON_B64: config.opencodeAuthJsonB64,
      GIST_URL: config.gistUrl,
      REPO_URL: config.repoUrl,
      REPO_SLUG: config.repoSlug,
      FRONT_DIR: config.frontDir,
      PLAN_FILE: config.planFile,
    },
    command: `
      curl -fsSL "${config.gistUrl}" -o run.sh
      chmod +x run.sh
      ./run.sh
    `,
  });
  
  // 4. セッション更新
  await updateSession(session.id, { sandboxId, status: 'running' });
  
  return Response.json({ sessionId: session.id, sandboxId });
}

// app/api/sandbox/[sessionId]/logs/route.ts
export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // SSEでログをストリーミング
      const session = await getSession(params.sessionId);
      
      for await (const log of streamSandboxLogs(session.sandboxId)) {
        const data = `data: ${JSON.stringify(log)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 3. Vercel Sandbox統合

```typescript
// lib/sandbox.ts
import { SandboxClient } from '@vercel/sandbox';

export class SandboxManager {
  private client: SandboxClient;
  
  constructor() {
    this.client = new SandboxClient({
      token: process.env.VERCEL_TOKEN,
    });
  }
  
  async createSandbox(config: {
    env: Record<string, string>;
    command: string;
  }) {
    const sandbox = await this.client.create({
      runtime: 'nodejs',
      env: config.env,
    });
    
    // コマンド実行
    const execution = await sandbox.execute({
      command: config.command,
      timeout: 3600000, // 60分
    });
    
    return {
      id: sandbox.id,
      execution,
    };
  }
  
  async *streamLogs(sandboxId: string) {
    const sandbox = await this.client.get(sandboxId);
    
    for await (const log of sandbox.streamLogs()) {
      yield {
        timestamp: new Date(),
        level: log.level,
        message: log.message,
      };
    }
  }
  
  async getSandboxStatus(sandboxId: string) {
    const sandbox = await this.client.get(sandboxId);
    return {
      status: sandbox.status,
      exitCode: sandbox.exitCode,
    };
  }
}
```

### 4. フロントエンド実装

```typescript
// app/sandbox/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SandboxConfigForm } from '@/components/SandboxConfigForm';
import { LogViewer } from '@/components/LogViewer';
import { StatusBadge } from '@/components/StatusBadge';

export default function SandboxPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Sandbox作成
  const createSandbox = useMutation({
    mutationFn: async (config: SandboxConfig) => {
      const res = await fetch('/api/sandbox/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
    },
  });
  
  // ログストリーミング
  const { data: logs } = useQuery({
    queryKey: ['logs', sessionId],
    queryFn: async () => {
      const eventSource = new EventSource(
        `/api/sandbox/${sessionId}/logs`
      );
      
      const logs: LogEntry[] = [];
      
      eventSource.onmessage = (event) => {
        const log = JSON.parse(event.data);
        logs.push(log);
      };
      
      return logs;
    },
    enabled: !!sessionId,
    refetchInterval: false,
  });
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        Coding Agent Sandbox
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <SandboxConfigForm
            onSubmit={(config) => createSandbox.mutate(config)}
            isLoading={createSandbox.isPending}
          />
        </div>
        
        <div>
          {sessionId && (
            <>
              <StatusBadge sessionId={sessionId} />
              <LogViewer logs={logs || []} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 5. セキュリティ対策

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 認証チェック
  const token = request.cookies.get('auth-token');
  
  if (!token && request.nextUrl.pathname.startsWith('/api/sandbox')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Rate limiting
  const ip = request.ip || 'unknown';
  const rateLimitKey = `rate-limit:${ip}`;
  
  // Vercel KVでrate limit管理
  // ...
  
  return NextResponse.next();
}

// lib/validation.ts
export function validateConfig(config: SandboxConfig) {
  // 入力値の検証
  if (!isValidUrl(config.gistUrl)) {
    throw new Error('Invalid Gist URL');
  }
  
  if (!isValidGitHubRepo(config.repoUrl)) {
    throw new Error('Invalid GitHub repository URL');
  }
  
  // トークンのマスキング
  if (config.githubToken.length < 20) {
    throw new Error('Invalid GitHub token');
  }
  
  // パストラバーサル防止
  if (config.frontDir.includes('..')) {
    throw new Error('Invalid directory path');
  }
}
```

### 6. 環境変数設計

```bash
# .env.local
VERCEL_TOKEN=xxx
DATABASE_URL=xxx
VERCEL_KV_URL=xxx
VERCEL_BLOB_TOKEN=xxx

# ユーザーごとに保存
GITHUB_TOKEN=<encrypted>
OPENCODE_AUTH_JSON_B64=<encrypted>
```

## デプロイ構成

```yaml
# vercel.json
{
  "functions": {
    "api/sandbox/**/*.ts": {
      "maxDuration": 300
    }
  },
  "env": {
    "VERCEL_TOKEN": "@vercel-token",
    "DATABASE_URL": "@database-url"
  }
}
```

## 拡張ポイント

1. **マルチテナント対応**: ユーザー認証・権限管理
2. **履歴管理**: 過去の実行結果の保存・検索
3. **テンプレート機能**: よく使う設定の保存
4. **通知機能**: 完了時のメール/Slack通知
5. **コスト管理**: Sandbox使用量の追跡・制限

このシステム設計でブラウザから安全にコーディングエージェントを実行できます。ご質問や追加要件があればお聞かせください。
