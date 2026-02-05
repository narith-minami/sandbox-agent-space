# AI Code Review Integration

OpenCodeとAI Code Reviewを統合した自動コードレビュー＆修正ワークフロー

## 📋 概要

このツールセットは以下の機能を提供します:

1. **自動実装**: OpenCodeによるコード生成
2. **AIレビュー**: 複数タイプの並列レビュー（Security/Performance/Comprehensive）
3. **自動分析**: レビュー結果の構造化分析
4. **自動修正**: 問題が見つかった場合の反復修正
5. **PR作成**: GitHub PRの自動作成とレビュー結果の添付

## 🚀 クイックスタート

### 1. 初期セットアップ

```bash
# リポジトリをクローン
git clone <your-repo>
cd <your-repo>

# スクリプトに実行権限を付与
chmod +x scripts/*.sh
chmod +x scripts/review-tools/*.js

# .env.local をセットアップ
./scripts/setup-env.sh

# .env.local を編集してAPIキーを設定
vim .env.local  # または code .env.local
```

### 2. APIキーの取得

少なくとも1つのAIプロバイダーのAPIキーが必要です:

- **Anthropic Claude** (推奨): https://console.anthropic.com/settings/keys
  - コスト: $0.25/1M tokens (Haiku)
  - 速度: 最速
  
- **OpenAI GPT**: https://platform.openai.com/api-keys
  - コスト: $0.15/1M tokens (GPT-4o-mini)
  
- **Google Gemini**: https://makersuite.google.com/app/apikey
  - コスト: 無料枠あり

また、PR作成のためにGitHub Personal Access Tokenが必要です:
- https://github.com/settings/tokens
- 必要なscopes: `repo`, `workflow`

### 3. ベーススナップショットの作成（初回のみ）

```bash
# Vercel Sandbox CLIでスナップショット作成
./scripts/run-create-snapshot-via-cli.sh

# スナップショットIDが scripts/snapshot-id.txt に保存されます
```

### 4. ワークフロー実行

```bash
# スナップショットIDを使用してワークフロー実行
SNAPSHOT_ID=$(cat scripts/snapshot-id.txt) \
  ./scripts/integrated-review-workflow.sh
```

## 📁 ディレクトリ構造

```
.
├── .env.local.template          # 環境変数テンプレート
├── .ai-review-config.json       # AIレビュー設定
├── .gitignore                   # Git除外設定
├── README.md                    # このファイル
└── scripts/
    ├── setup-env.sh            # 環境設定スクリプト
    ├── create-base-snapshot.sh # スナップショット作成
    ├── integrated-review-workflow.sh  # メインワークフロー
    └── review-tools/
        └── analyze-review.js   # レビュー分析ツール
```

## 🔧 設定ファイル

### .env.local

APIキーと認証情報を格納します（**Gitには含めない**）:

```bash
# 必須: AIプロバイダー（いずれか1つ）
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GEMINI_API_KEY=...

# 必須: GitHub Token
GITHUB_TOKEN=ghp_...

# オプション: Vercel Token
# VERCEL_TOKEN=...
```

### .ai-review-config.json

AIレビューの動作を設定します:

- `provider`: 使用するAIプロバイダー
- `model`: 使用するモデル
- `reviewTypes`: レビュータイプごとの設定
- `frameworks`: Laravel/Next.js固有のチェック

## 🎯 ワークフローの詳細

### フロー図

```
1. OpenCode実装
   ↓
2. 並列AIレビュー (Security/Performance/Comprehensive)
   ↓
3. レビュー結果分析
   ↓
4. 問題あり？
   ├─ Yes → OpenCodeで修正 → 2に戻る（最大3回）
   └─ No  → 5へ
   ↓
5. 最終品質チェック (Biome/TypeScript/Lint)
   ↓
6. Gitコミット＆PR作成
```

### 反復修正

critical/highの問題が見つかった場合、自動的に修正を試みます:

- 最大反復回数: 3回（`MAX_REVIEW_ITERATIONS`で変更可能）
- 各反復で問題を修正し、再レビュー
- すべての問題が解決されるか、最大回数に達するまで継続

## 📊 コスト試算

### 1PRあたりのコスト（Claude Haiku使用時）

```
初期実装: $0.003
レビュー×3種類×2回: $0.006
修正実装×1回: $0.003
---
合計: 約$0.012/PR
```

### 月間コスト

```
月100PR: $1.20
月500PR: $6.00
```

## 🛠️ トラブルシューティング

### APIキーエラー

```bash
❌ No AI provider API key found in .env.local
```

**解決方法**: `.env.local`に少なくとも1つのAPIキーを設定してください。

### レビュー結果が見つからない

```bash
⚠️  No review files found
```

**解決方法**: 
- `ai-code-review`が正しくインストールされているか確認
- ネットワーク接続を確認
- APIキーが有効か確認

### PR作成失敗

```bash
❌ Failed to create pull request
```

**解決方法**:
- `GITHUB_TOKEN`が正しく設定されているか確認
- トークンに`repo`と`workflow`のscopesがあるか確認
- ブランチ名が既に存在しないか確認

## 📚 詳細ドキュメント

### レビュータイプ

1. **Security Review**
   - 認証/認可の問題
   - SQLインジェクション
   - XSS脆弱性
   - CSRF対策
   - シークレット漏洩

2. **Performance Review**
   - N+1クエリ問題
   - キャッシング
   - バンドルサイズ
   - メモリリーク
   - API呼び出し最適化

3. **Comprehensive Review**
   - コード品質
   - ベストプラクティス
   - 保守性
   - テストカバレッジ
   - エラーハンドリング

### カスタマイズ

#### 最大反復回数の変更

```bash
MAX_REVIEW_ITERATIONS=5 ./scripts/integrated-review-workflow.sh
```

#### 別のAIモデルの使用

`.ai-review-config.json`を編集:

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  ...
}
```

## 🤝 貢献

バグ報告や機能リクエストは Issue でお願いします。

## 📄 ライセンス

MIT License

## 🔗 関連リンク

- [AI Code Review 4.0.2](https://www.npmjs.com/package/@bobmatnyc/ai-code-review)
- [Anthropic Claude](https://www.anthropic.com/)
- [OpenAI Platform](https://platform.openai.com/)
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox)
