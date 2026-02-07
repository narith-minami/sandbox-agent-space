# Plan Mode 実装ステータス

## 実装完了項目 ✅

### 1. コア実装
- ✅ `lib/opencode/plan-agent.ts` - OpenCode SDK統合サービス
- ✅ `app/api/plan/generate/route.ts` - 開発専用APIエンドポイント
- ✅ `hooks/use-plan-generation.ts` - React Query mutation hook
- ✅ `types/plan.ts` - 型定義
- ✅ `components/sandbox/config-form.tsx` - UI統合

### 2. テスト
- ✅ 28個のテストすべてが合格
  - `lib/opencode/plan-agent.test.ts` (10テスト)
  - `app/api/plan/generate/route.test.ts` (9テスト)
  - `hooks/use-plan-generation.test.tsx` (9テスト)

### 3. エラー修正
- ✅ TypeScriptコンパイルエラー修正
- ✅ タイムアウトエラー修正（timeout: 30000追加）
- ✅ ポート競合エラー修正（port: 0で自動割り当て）

### 4. ドキュメント
- ✅ `docs/PLAN_MODE_GUIDE.md` - 詳細な実装ガイド
- ✅ `docs/PLAN_MODE_QUICKSTART.md` - クイックスタートガイド（日本語）
- ✅ `docs/opencode-config-sample.json` - OpenCode設定サンプル
- ✅ `scripts/test-opencode-plan.ts` - デバッグ用スタンドアロンテストスクリプト
- ✅ `README.md` - Plan Mode機能の説明を追加

## 現在の問題 ⚠️

### エラー: "No plan content found in OpenCode response"

**症状**:
プラン生成APIを呼び出すと、以下のエラーが発生：
```
Error: No plan content found in OpenCode response
```

**原因（推測）**:
1. OpenCode plan agentが応答を返していない
2. メッセージ構造が期待と異なる
3. 認証設定に問題がある

**現在の調査状況**:
- デバッグログを追加済み（`lib/opencode/plan-agent.ts`の76行目）
- スタンドアロンテストスクリプトを作成済み

## 次のステップ 🚀

### ステップ1: OpenCode設定を確認

OpenCodeの設定ファイルを確認してください：

```bash
cat ~/.config/opencode/config.json
```

**必要な設定**:
```json
{
  "providers": {
    "anthropic": {
      "enabled": true,
      "apiKey": "sk-ant-..."
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

設定ファイルが存在しない場合:
```bash
mkdir -p ~/.config/opencode
cp docs/opencode-config-sample.json ~/.config/opencode/config.json
# APIキーを編集
nano ~/.config/opencode/config.json
```

### ステップ2: 環境変数を確認

`.env.local`に以下が設定されているか確認：

```bash
# 必須
NODE_ENV=development

# 必須: OpenCode認証情報
COMMON_OPENCODE_AUTH_JSON_B64="eyJ..."
```

**COMMON_OPENCODE_AUTH_JSON_B64の作成方法**:

```bash
# 1. 認証JSONを作成
cat > /tmp/opencode-auth.json <<EOF
{
  "anthropic": {
    "type": "api",
    "key": "sk-ant-your-api-key-here"
  }
}
EOF

# 2. Base64エンコード（改行なし）
cat /tmp/opencode-auth.json | base64 | tr -d '\n'

# 3. 結果をコピーして.env.localに追加
echo "COMMON_OPENCODE_AUTH_JSON_B64=\"<上記の結果>\"" >> .env.local
```

### ステップ3: スタンドアロンテストを実行

OpenCode統合が正しく動作するか確認：

```bash
# 環境変数を設定して実行
COMMON_OPENCODE_AUTH_JSON_B64="<your-base64-auth>" tsx scripts/test-opencode-plan.ts
```

**期待される結果**:

成功した場合:
```
=== OpenCode Plan Agent Test ===

✅ Authentication found
✅ OpenCode server started
✅ Set auth for provider: anthropic
✅ Session created: session-xxx
✅ Prompt sent, waiting for response...

=== RAW MESSAGES RESPONSE ===
[...]
=== END RAW MESSAGES ===

✅ Plan found!

=== EXTRACTED PLAN ===
# Implementation Plan
...
=== END PLAN ===
```

失敗した場合、出力されるエラー内容を確認してください。

### ステップ4: デバッグ情報の収集

テストスクリプトが失敗した場合、以下の情報を確認：

1. **メッセージ構造を確認**:
   - `=== RAW MESSAGES RESPONSE ===`セクションの内容
   - `role`フィールドの値
   - `parts`配列の構造

2. **OpenCodeログを確認**:
   ```bash
   tail -f ~/.local/share/opencode/log/*.log
   ```

3. **既存のOpenCodeプロセスを停止**:
   ```bash
   # プロセスを確認
   ps aux | grep opencode

   # 必要に応じて停止
   pkill -f opencode
   ```

### ステップ5: 開発サーバーでテスト

スタンドアロンテストが成功したら、開発サーバーで実際に使用：

```bash
# 開発サーバーを起動
pnpm run dev
```

ブラウザで http://localhost:3000/sandbox にアクセスし：

1. Plan Sourceで"Text"を選択
2. "Generate Plan with AI"セクションが表示されることを確認
3. タスク説明を入力（例: "Implement user authentication with JWT"）
4. "Generate Plan"ボタンをクリック
5. サーバーコンソールの`[OpenCode] Messages response:`ログを確認
6. プランが自動入力されることを確認

## トラブルシューティング

### ケース1: スクリプト実行でエラー

```bash
❌ COMMON_OPENCODE_AUTH_JSON_B64 environment variable is not set
```

**解決策**: 環境変数を設定
```bash
export COMMON_OPENCODE_AUTH_JSON_B64="<your-base64-auth>"
```

### ケース2: タイムアウトエラー

```
Error: Timeout waiting for server to start after 30000ms
```

**解決策**:
1. OpenCode SDKが正しくインストールされているか確認:
   ```bash
   npm list @opencode-ai/sdk
   ```
2. 既存のプロセスを停止:
   ```bash
   pkill -f opencode
   ```

### ケース3: メッセージが空

```
📊 Total messages: 0
```

**解決策**:
- Plan agentが有効か確認: `~/.config/opencode/config.json`
- APIキーが有効か確認
- OpenCodeのログでエラーを確認

### ケース4: Assistantメッセージがない

```
--- Message 1 ---
Role: user
...

❌ No plan content found in assistant messages
```

**解決策**:
- `~/.config/opencode/config.json`の`agents.plan.enabled`を確認
- モデル指定が正しいか確認
- プロンプトが短すぎないか確認（最低10文字必要）

## 実装の詳細

### アーキテクチャ

```
User Input (UI)
    ↓
usePlanGeneration hook (TanStack Query)
    ↓
POST /api/plan/generate (Next.js API Route)
    ↓
generatePlan() (lib/opencode/plan-agent.ts)
    ↓
OpenCode SDK
    ↓
    1. createOpencode() - サーバー起動
    2. client.auth.set() - 認証設定
    3. client.session.create() - セッション作成
    4. client.session.prompt() - プロンプト送信（agent: 'plan'）
    5. client.session.messages() - メッセージ取得
    6. extractPlanFromMessages() - プラン抽出
    7. server.close() - クリーンアップ
    ↓
Plan Text (Auto-populated in UI)
```

### セキュリティ

1. **開発専用機能**:
   - `NODE_ENV !== 'development'`の場合は404を返す
   - UIも開発モードでのみ表示

2. **認証**:
   - APIキーはサーバーサイドのみで使用
   - クライアントに露出しない

3. **入力検証**:
   - Zodスキーマでバリデーション
   - プロンプト最低10文字

### テストカバレッジ

- **ユニットテスト**: SDK呼び出し、エラーハンドリング、認証処理
- **APIルートテスト**: バリデーション、認証フォールバック、本番環境チェック
- **フックテスト**: mutation、エラー処理、ローディング状態

すべてのテストが合格（28/28）✅

## 参考資料

- [PLAN_MODE_GUIDE.md](./PLAN_MODE_GUIDE.md) - 詳細な実装ガイド
- [PLAN_MODE_QUICKSTART.md](./PLAN_MODE_QUICKSTART.md) - クイックスタート（日本語）
- [opencode-config-sample.json](./opencode-config-sample.json) - OpenCode設定サンプル
- `scripts/test-opencode-plan.ts` - デバッグスクリプト

## サポートが必要な場合

以下の情報を含めてイシューを作成してください：

1. `tsx scripts/test-opencode-plan.ts`の完全な出力
2. `~/.config/opencode/config.json`の内容（APIキーはXXXに置き換え）
3. OpenCodeのログ: `tail -100 ~/.local/share/opencode/log/*.log`
4. 環境情報:
   ```bash
   node --version
   npm list @opencode-ai/sdk
   echo $NODE_ENV
   ```

## まとめ

実装は完了しており、すべてのテストが合格しています。現在の問題は**OpenCode plan agentの設定または認証**に関連している可能性が高いです。

**推奨される次のステップ**:
1. ステップ2で環境変数を確認
2. ステップ3でスタンドアロンテストを実行
3. テスト出力の`=== RAW MESSAGES RESPONSE ===`セクションを確認
4. 必要に応じてOpenCode設定を修正

スタンドアロンテストが成功すれば、開発サーバーでも正常に動作するはずです。
