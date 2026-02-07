# Plan Mode 実装ガイド

## 概要

Plan Modeは、OpenCode SDKの`plan`エージェントを使用してAIによる実装プランを自動生成する機能です。

## OpenCode SDK の仕組み

### 基本的なフロー

```
1. OpenCodeサーバー起動 (createOpencode)
   ↓
2. セッション作成 (session.create)
   ↓
3. プロンプト送信 (session.prompt) with agent: 'plan'
   ↓
4. エージェント処理（AIがプランを生成）
   ↓
5. メッセージ取得 (session.messages)
   ↓
6. プラン抽出とクリーンアップ (server.close)
```

### コード実装の詳細

**ファイル**: `lib/opencode/plan-agent.ts`

```typescript
// 1. サーバー起動
const { client, server } = await createOpencode({
  timeout: 30000,  // サーバー起動タイムアウト
  port: 0,         // 自動ポート割り当て
});

// 2. 認証設定（オプション）
if (auth) {
  const authJson = JSON.parse(Buffer.from(auth, 'base64').toString('utf-8'));
  for (const [providerId, providerAuth] of Object.entries(authJson)) {
    await client.auth.set({
      path: { id: providerId },
      body: providerAuth,
    });
  }
}

// 3. セッション作成
const sessionResponse = await client.session.create({});
const sessionId = sessionResponse.data.id;

// 4. プロンプト送信（planエージェント指定）
await client.session.prompt({
  path: { id: sessionId },
  body: {
    agent: 'plan',  // ← 重要：planエージェントを指定
    parts: [
      {
        type: 'text',
        text: prompt,  // ユーザーからのタスク説明
      },
    ],
  },
});

// 5. メッセージ取得
const messagesResponse = await client.session.messages({
  path: { id: sessionId },
});

// 6. プラン抽出
const planContent = extractPlanFromMessages(messagesResponse.data);
```

## 必要な設定

### 1. 環境変数

**開発環境** (`.env.local`):
```bash
# 必須：開発モードの有効化
NODE_ENV=development

# 必須：OpenCode認証情報（base64エンコード済みJSON）
COMMON_OPENCODE_AUTH_JSON_B64="eyJ..."
```

### 2. OpenCode認証JSONの構造

`COMMON_OPENCODE_AUTH_JSON_B64`は以下のJSON構造をbase64エンコードしたものです：

```json
{
  "anthropic": {
    "type": "api",
    "key": "sk-ant-..."
  },
  "openai": {
    "type": "oauth",
    "access": "...",
    "refresh": "...",
    "expiresAt": 1234567890
  },
  "github-copilot": {
    "type": "oauth",
    "refresh": "gho_...",
    "access": "gho_...",
    "expires": 0
  }
}
```

**エンコード方法**:
```bash
# JSONファイルを作成
cat > opencode-auth.json <<EOF
{
  "anthropic": {
    "type": "api",
    "key": "your-api-key-here"
  }
}
EOF

# base64エンコード
cat opencode-auth.json | base64 | tr -d '\n'
```

### 3. OpenCode設定ファイル

**場所**: `~/.config/opencode/config.json`

**推奨設定**:
```json
{
  "providers": {
    "anthropic": {
      "enabled": true
    }
  },
  "agents": {
    "plan": {
      "enabled": true,
      "model": {
        "providerId": "anthropic",
        "modelId": "claude-sonnet-4-5"
      }
    }
  }
}
```

## メッセージ構造の理解

### OpenCodeが返すメッセージの形式

```typescript
[
  {
    info: {
      role: 'user',      // ユーザーメッセージ
      // ...
    },
    parts: [
      {
        type: 'text',
        text: 'Implement user authentication'
      }
    ]
  },
  {
    info: {
      role: 'assistant', // AIの応答（これを抽出）
      // ...
    },
    parts: [
      {
        type: 'text',
        text: '# Implementation Plan\n\n1. ...'  // ← これがプラン
      }
    ]
  }
]
```

### プラン抽出ロジック

```typescript
function extractPlanFromMessages(messages: unknown): string {
  // 1. メッセージ配列の検証
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Invalid messages response from OpenCode');
  }

  // 2. 最後からassistantメッセージを検索
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as OpencodeMessage;

    // 3. assistantロールのメッセージを見つける
    if (message?.info?.role === 'assistant' && Array.isArray(message.parts)) {
      // 4. textタイプのパートを抽出
      const textParts = message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .filter((text): text is string => !!text?.trim());

      // 5. テキストを結合して返す
      if (textParts.length > 0) {
        return textParts.join('\n\n');
      }
    }
  }

  // 6. プランが見つからない場合はエラー
  throw new Error('No plan content found in OpenCode response');
}
```

## トラブルシューティング

### エラー: "No plan content found in OpenCode response"

**原因の可能性**:

1. **planエージェントが応答していない**
   - OpenCodeの設定でplanエージェントが有効か確認
   - 認証情報が正しく設定されているか確認

2. **メッセージ構造が想定と異なる**
   - デバッグログを確認: `console.log('[OpenCode] Messages response:', ...)`
   - メッセージに`info.role === 'assistant'`が存在するか
   - `parts`配列に`type === 'text'`のエントリがあるか

3. **タイムアウト前にセッションが終了**
   - セッションが完了する前にmessagesを取得している可能性
   - `session.prompt()`の戻り値を待つ必要があるかも

### デバッグ手順

1. **サーバーログを確認**:
```bash
tail -f ~/.local/share/opencode/log/*.log
```

2. **開発サーバーのコンソールログを確認**:
   - `[OpenCode] Messages response:` で始まるログを探す
   - メッセージの構造を確認

3. **OpenCode CLIで直接テスト**:
```bash
# OpenCodeが正しく動作するか確認
opencode serve

# 別のターミナルで
curl -X POST http://localhost:4096/session \
  -H "Content-Type: application/json" \
  -d '{"agent": "plan", "prompt": "Test task"}'
```

### よくある問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| Timeout waiting for server | サーバー起動に時間がかかる | `timeout: 30000` に設定済み |
| Port 4096 in use | 既存のOpenCodeプロセス | `port: 0` で自動割り当て |
| No plan content found | エージェントが応答していない | 認証設定とagent設定を確認 |
| Server exited with code 1 | OpenCode設定エラー | `~/.config/opencode/config.json` を確認 |

## 期待される動作

### 正常なフロー

1. ユーザーがUIでタスクを入力（例: "ユーザー認証を実装"）
2. `POST /api/plan/generate` が呼ばれる
3. OpenCodeサーバーが起動（ポート自動割り当て）
4. セッション作成とプロンプト送信
5. planエージェントがプランを生成（5-30秒）
6. メッセージからプラン抽出
7. UIのplanTextフィールドに自動入力
8. サーバーをクローズ

### 生成されるプランの例

```markdown
# Implementation Plan

## Overview
Implement user authentication system with JWT tokens

## Steps

### 1. Set up JWT library
- Install jsonwebtoken package
- Configure secret key in environment

### 2. Create authentication middleware
- File: middleware/auth.ts
- Verify JWT tokens
- Attach user to request

### 3. Implement login endpoint
- File: api/auth/login.ts
- Validate credentials
- Generate JWT token

### 4. Add protected routes
- Apply auth middleware
- Handle unauthorized access

## Testing
- Unit tests for JWT generation/validation
- Integration tests for login flow
```

## API仕様

### エンドポイント: POST /api/plan/generate

**リクエスト**:
```json
{
  "prompt": "Implement user authentication with JWT",
  "opencodeAuthJsonB64": "optional-override-auth"
}
```

**レスポンス（成功）**:
```json
{
  "plan": "# Implementation Plan\n\n...",
  "sessionId": "opencode-session-id"
}
```

**レスポンス（エラー）**:
```json
{
  "error": "Failed to generate plan",
  "message": "Detailed error message"
}
```

**ステータスコード**:
- `200`: 成功
- `400`: リクエストエラー（プロンプト不足、認証情報なし）
- `404`: 本番環境でアクセス（開発専用機能）
- `500`: サーバーエラー（OpenCode SDK エラー）

## 次のステップ

実際のメッセージ構造を確認するために：

1. 開発サーバーを起動: `pnpm run dev`
2. プラン生成を試す
3. サーバーのコンソールで `[OpenCode] Messages response:` を確認
4. メッセージ構造が期待通りか検証
5. 必要に応じて`extractPlanFromMessages`の修正を検討
