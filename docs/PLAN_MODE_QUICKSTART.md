# Plan Mode クイックスタートガイド

Plan Mode機能のセットアップとデバッグ手順を説明します。

## 前提条件

- Node.js 18+ がインストールされていること
- pnpm がインストールされていること
- Anthropic APIキーを持っていること

## セットアップ手順

### 1. OpenCode設定ファイルの作成

OpenCodeの設定ファイルを作成します：

```bash
# 設定ディレクトリを作成
mkdir -p ~/.config/opencode

# サンプル設定をコピー
cp docs/opencode-config-sample.json ~/.config/opencode/config.json

# 設定ファイルを編集してAPIキーを設定
nano ~/.config/opencode/config.json
```

設定ファイルの例：

```json
{
  "providers": {
    "anthropic": {
      "enabled": true,
      "apiKey": "sk-ant-your-api-key-here"
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

### 2. 認証情報のbase64エンコード

OpenCode認証情報をbase64エンコードします：

```bash
# auth.jsonファイルを作成
cat > /tmp/opencode-auth.json <<EOF
{
  "anthropic": {
    "type": "api",
    "key": "sk-ant-your-api-key-here"
  }
}
EOF

# base64エンコード（改行なし）
cat /tmp/opencode-auth.json | base64 | tr -d '\n'

# 結果をコピーして環境変数に設定
```

### 3. 環境変数の設定

プロジェクトの`.env.local`ファイルに以下を追加：

```bash
# 開発モードを有効化
NODE_ENV=development

# OpenCode認証情報（上記でエンコードした値）
COMMON_OPENCODE_AUTH_JSON_B64="eyJhbnRocm9waWMiOnsidHlwZSI6ImFwaSIsImtleSI6InNrLWFudC0uLi4ifX0="
```

## デバッグ手順

### ステップ1: スタンドアロンテストスクリプトを実行

まず、OpenCode SDKが正しく動作するか確認します：

```bash
# テストスクリプトに実行権限を付与
chmod +x scripts/test-opencode-plan.ts

# 環境変数を設定して実行
COMMON_OPENCODE_AUTH_JSON_B64="<your-base64-auth>" tsx scripts/test-opencode-plan.ts
```

**期待される出力**:

```
=== OpenCode Plan Agent Test ===

✅ Authentication found

📡 Initializing OpenCode SDK...
✅ OpenCode server started

🔐 Setting authentication...
✅ Set auth for provider: anthropic

📝 Creating OpenCode session...
✅ Session created: session-xxx

🤖 Sending prompt to plan agent...
Prompt: "Create a simple implementation plan for adding user authentication with JWT tokens"
✅ Prompt sent, waiting for response...

📬 Fetching session messages...

=== RAW MESSAGES RESPONSE ===
[
  {
    "info": { "role": "user" },
    "parts": [{ "type": "text", "text": "..." }]
  },
  {
    "info": { "role": "assistant" },
    "parts": [{ "type": "text", "text": "# Implementation Plan\n\n..." }]
  }
]
=== END RAW MESSAGES ===

📊 Total messages: 2

✅ Plan found!

=== EXTRACTED PLAN ===
# Implementation Plan
...
=== END PLAN ===
```

### ステップ2: 問題の特定

スクリプトの出力を確認して問題を特定します：

#### ケース1: 認証エラー

```
❌ COMMON_OPENCODE_AUTH_JSON_B64 environment variable is not set
```

**解決策**: `.env.local`に`COMMON_OPENCODE_AUTH_JSON_B64`を設定

#### ケース2: サーバー起動エラー

```
Error: Timeout waiting for server to start after 30000ms
```

**解決策**:
- OpenCodeが正しくインストールされているか確認: `npm list @opencode-ai/sdk`
- 既存のOpenCodeプロセスを停止: `pkill -f opencode`

#### ケース3: ポート競合エラー

```
Error: Failed to start server on port 4096
```

**解決策**:
- 既存のプロセスを確認: `lsof -i :4096`
- プロセスを停止: `kill <PID>`
- または、自動ポート割り当てを使用（既に`port: 0`で実装済み）

#### ケース4: メッセージが空

```
📊 Total messages: 0
```

**解決策**:
- Plan agentが有効か確認: `~/.config/opencode/config.json`
- 認証情報が正しいか確認
- APIキーの権限を確認

#### ケース5: Assistantメッセージがない

```
📊 Total messages: 1

--- Message 1 ---
Role: user
...

❌ No plan content found in assistant messages
```

**解決策**:
- Plan agentの設定を確認: `~/.config/opencode/config.json`の`agents.plan.enabled`
- モデル指定が正しいか確認: `agents.plan.model.modelId`
- Anthropic APIキーが有効か確認

### ステップ3: 開発サーバーでテスト

スタンドアロンスクリプトが成功したら、開発サーバーでテストします：

```bash
# 開発サーバーを起動
pnpm run dev
```

ブラウザで http://localhost:3000 にアクセスし：

1. サンドボックス設定フォームに移動
2. "Plan Source"で"Text"を選択
3. "Generate Plan with AI"セクションが表示されることを確認
4. タスク説明を入力（例: "Add user authentication with JWT"）
5. "Generate Plan"ボタンをクリック
6. プランが自動入力されることを確認

### ステップ4: ブラウザコンソールとサーバーログを確認

**ブラウザコンソール**（開発者ツール）:
- ネットワークタブで`/api/plan/generate`のレスポンスを確認
- エラーメッセージを確認

**サーバーコンソール**:
- `[OpenCode] Messages response:` のログを探す
- メッセージ構造を確認

## トラブルシューティング

### OpenCodeのログを確認

```bash
# OpenCodeのログディレクトリを確認
tail -f ~/.local/share/opencode/log/*.log
```

### OpenCode CLIで直接テスト

```bash
# OpenCodeサーバーを直接起動
opencode serve

# 別のターミナルでテスト
curl -X POST http://localhost:4096/session \
  -H "Content-Type: application/json" \
  -d '{"agent": "plan", "prompt": "Test task"}'
```

### パッケージの再インストール

```bash
# node_modulesをクリーン
rm -rf node_modules pnpm-lock.yaml

# 再インストール
pnpm install
```

## よくある質問

### Q: "No plan content found in OpenCode response" エラーが出る

**A**: 以下を確認してください：

1. `~/.config/opencode/config.json`でplan agentが有効か
2. 認証情報が正しく設定されているか
3. スタンドアロンテストスクリプトで詳細なログを確認
4. OpenCodeのバージョンが`@opencode-ai/sdk@1.1.53`以上か

### Q: UIに"Generate Plan with AI"が表示されない

**A**: `NODE_ENV=development`が設定されているか確認してください。本番環境では表示されません。

### Q: タイムアウトエラーが出る

**A**: ネットワークが遅い場合、`lib/opencode/plan-agent.ts`の`timeout: 30000`を増やしてください（例: `60000`）。

## 参考資料

- [PLAN_MODE_GUIDE.md](./PLAN_MODE_GUIDE.md) - 詳細な実装ガイド
- [OpenCode SDK Documentation](https://github.com/opencode-ai/sdk) - OpenCode SDK公式ドキュメント

## サポート

問題が解決しない場合は、以下の情報を含めてイシューを作成してください：

1. `tsx scripts/test-opencode-plan.ts`の完全な出力
2. `~/.config/opencode/config.json`の内容（APIキーは除く）
3. OpenCodeのバージョン: `npm list @opencode-ai/sdk`
4. Node.jsのバージョン: `node --version`
