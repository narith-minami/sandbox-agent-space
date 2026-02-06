# Sandbox Agent Space

Vercel Sandbox SDK を統合した Next.js 16 アプリケーション。安全な Linux microVM 内で、独立したコーディングエージェントタスクを実行します。

## 機能

- 🚀 **Vercel Sandbox SDK 統合** - 独立した Linux microVM でコードを実行
- 🔄 **セッション管理** - サンドボックス実行セッションの追跡と管理
- 📊 **リアルタイムログストリーミング** - Server-Sent Events による stdout/stderr ログのストリーミング
- 💾 **スナップショット対応** - サンドボックススナップショットの作成と復元
- 🔁 **セッションのクローン** - 以前の設定をワンクリックでクローン
- ⚙️ **共通設定** - 環境変数でデフォルト値を設定
- 💾 **LocalStorage 永続化** - 最後に使用したリポジトリ設定を記憶
- 🎯 **複数ランタイム対応** - Node.js 24、Node.js 22、Python 3.13 をサポート
- ⏱️ **タイムアウト設定** - デフォルト10分、最大45分まで設定可能
- 🤖 **AI モデル設定** - AI プロバイダーとモデルの設定（Anthropic、OpenAI、Gemini）
- 🔒 **Basic 認証** - 本番デプロイ用のパスワード保護（オプション）
- 📦 **セッションアーカイブ** - 完了したセッションをアーカイブして整理
- 🧪 **包括的なテスト** - Vitest によるコア機能のユニットテスト
- 🔧 **テストヘルパー** - テストの重複を減らす共有ユーティリティ

## はじめに

### 前提条件

- Node.js 18+ 
- PostgreSQL データベース
- Vercel アカウント（認証用）

### インストール

1. リポジトリをクローン:
```bash
git clone <repository-url>
cd sandbox-agent-space
```

2. 依存関係をインストール:
```bash
pnpm install
```

3. 環境変数を設定:
```bash
cp .env.example .env.local
```

`.env.local` を編集して設定:
- `DATABASE_URL` - PostgreSQL 接続文字列
- `COMMON_GITHUB_TOKEN`（オプション）- デフォルトの GitHub トークン
- `COMMON_OPENCODE_AUTH_JSON_B64`（オプション）- デフォルトの OpenCode 認証
- `COMMON_GIST_URL`（オプション）- デフォルトの Gist スクリプト URL
- `COMMON_MODEL_PROVIDER`（オプション）- AI モデルプロバイダー
- `COMMON_MODEL_ID`（オプション）- AI モデル ID

4. Vercel 認証を設定（サンドボックス作成に必須）:

**ローカル開発の場合:**
```bash
vercel link          # Vercel プロジェクトにリンク
vercel env pull      # OIDC トークンを .env.local にプル
```

**Vercel 上の本番環境の場合:** 
`VERCEL_OIDC_TOKEN` により認証は自動的に行われます。

5. データベースを初期化:
```bash
pnpm run db:push
```

6. 開発サーバーを起動:
```bash
pnpm run dev
```

[http://localhost:3000](http://localhost:3000) でアプリケーションを確認できます。

## 環境変数

### 必須
- `DATABASE_URL` - PostgreSQL 接続文字列

### Vercel Sandbox 認証（いずれか1つ必須）
- `VERCEL_OIDC_TOKEN` - Vercel 上で自動設定、ローカル開発では `vercel env pull` を使用
- `VERCEL_ACCESS_TOKEN` - 代替の認証方法

### オプション設定
- `VERCEL_SANDBOX_RUNTIME` - デフォルトランタイム: `node24`、`node22`、または `python3.13`
- `VERCEL_SANDBOX_TIMEOUT_MS` - サンドボックスタイムアウト（ミリ秒、デフォルト: 600000 = 10分）
- `COMMON_GITHUB_TOKEN` - デフォルトの GitHub パーソナルアクセストークン
- `COMMON_OPENCODE_AUTH_JSON_B64` - デフォルトの OpenCode 認証（base64 エンコード JSON）
- `COMMON_GIST_URL` - デフォルトの Gist スクリプト URL
- `COMMON_MODEL_PROVIDER` - AI モデルプロバイダー: `anthropic`、`openai`、または `gemini`（デフォルト: anthropic）
- `COMMON_MODEL_ID` - AI モデル ID（デフォルト: claude-3-5-sonnet-20241022）
- `COMMON_ANTHROPIC_API_KEY` - AI ワークフロー用の Anthropic API キー
- `COMMON_OPENAI_API_KEY` - AI ワークフロー用の OpenAI API キー
- `COMMON_GEMINI_API_KEY` - AI ワークフロー用の Google Gemini API キー
- `BASIC_AUTH_USER` - Basic 認証ユーザー名（有効にするにはユーザーとパスワードの両方が必要）
- `BASIC_AUTH_PASSWORD` - Basic 認証パスワード
- `RATE_LIMIT_REQUESTS_PER_MINUTE` - API レート制限（デフォルト: 10）

詳細な設定オプションは `.env.example` を参照してください。

## 使い方

### 共通設定（推奨）

毎回認証情報を入力しないように、環境変数を設定します:

```bash
# .env.local に記述
COMMON_GITHUB_TOKEN="ghp_your_token_here"
COMMON_OPENCODE_AUTH_JSON_B64="eyJ..."
COMMON_GIST_URL="https://gist.githubusercontent.com/user/id/raw/script.sh"
COMMON_MODEL_PROVIDER="anthropic"
COMMON_MODEL_ID="claude-3-5-sonnet-20241022"
```

共通設定を行うと、フォームは以下のように動作します:
- ✅ これらのフィールドに「(共通設定を使用)」インジケーターが表示される
- ✅ 空欄のままでデフォルトを使用可能
- ✅ カスタム値を入力して上書き可能

### サンドボックスの作成

1. `/sandbox` に移動
2. 設定を構成（または共通設定のデフォルトを使用）:
   - **ランタイム**: Node.js または Python バージョンを選択
   - **Gist URL**: 実行するスクリプト（設定されている場合は共通設定を使用）
   - **リポジトリ**: クローンする GitHub リポジトリ（最後の使用から記憶）
   - **ディレクトリ**: 作業ディレクトリ（デフォルト: `frontend`）
   - **モデルプロバイダーと ID**: エージェントタスク用の AI モデル設定
   - **認証情報**: GitHub トークンと OpenCode 認証（設定されている場合は共通設定を使用）
3. 「Start Sandbox」をクリック
4. サンドボックス実行中のリアルタイムログを確認
5. 履歴ページから完了したセッションをアーカイブ可能（オプション）

### セッションのクローン

1. 以前のセッション詳細ページに移動
2. 「Clone This Session」ボタンをクリック
3. フォームが以前の設定で自動入力される
4. 必要に応じて変更して送信

### スナップショットの使用

実行中のサンドボックスのスナップショットを作成:
```bash
POST /api/sandbox/{sessionId}/snapshot
```

スナップショットから復元:
- サンドボックス作成時に「Snapshot ID」フィールドにスナップショット ID を入力
- スナップショットは7日後に期限切れ

## データベース管理

```bash
# スキーマ変更後にマイグレーションを生成
pnpm run db:generate

# データベースにスキーマ変更を適用
pnpm run db:push

# Drizzle Studio を開く（データベース GUI）
pnpm run db:studio
```

## API ルート

### サンドボックス管理
- `POST /api/sandbox/create` - 新しいサンドボックスを作成して起動
- `GET /api/sandbox/{sessionId}` - セッション詳細を取得
- `GET /api/sandbox/{sessionId}/status` - サンドボックスステータスを取得
- `GET /api/sandbox/{sessionId}/logs` - ログをストリーム（SSE）
- `POST /api/sandbox/{sessionId}/snapshot` - スナップショットを作成
- `POST /api/sandbox/{sessionId}/stop` - サンドボックスを停止

### セッションとスナップショット
- `GET /api/sessions` - すべてのセッションをリスト（ページネーション）
- `POST /api/sessions/{sessionId}/archive` - セッションをアーカイブ
- `POST /api/sessions/{sessionId}/unarchive` - セッションをアンアーカイブ
- `GET /api/snapshots` - すべてのスナップショットをリスト
- `GET /api/snapshots/{snapshotId}` - スナップショット詳細を取得
- `DELETE /api/snapshots/{snapshotId}` - スナップショットを削除

### 設定
- `GET /api/config` - 共通設定を取得（環境変数から）

## 技術スタック

- **フレームワーク**: Next.js 16（App Router）
- **言語**: TypeScript 5
- **データベース**: PostgreSQL + Drizzle ORM
- **UI**: React 19、Tailwind CSS 4、shadcn/ui
- **状態管理**: TanStack Query（React Query）
- **サンドボックス**: Vercel Sandbox SDK（@vercel/sandbox）
- **認証**: Vercel OIDC Token / Basic 認証
- **バリデーション**: Zod
- **テスト**: Vitest + Testing Library
- **リント/フォーマット**: Biome

## プロジェクト構造

```
 ├── app/
 │   ├── api/              # API ルート
 │   ├── sandbox/          # サンドボックスページ
 │   ├── history/          # セッション履歴
 │   ├── settings/         # 設定ページ
 │   ├── login/            # ログインページ（Basic 認証）
 │   └── ...
 ├── components/
 │   ├── sandbox/          # サンドボックス固有のコンポーネント
 │   └── ui/               # shadcn/ui コンポーネント
 ├── hooks/                # カスタム React フック
 ├── lib/
│   ├── api/              # API ユーティリティ（バリデーター、設定ビルダー）
│   ├── db/               # データベーススキーマとクエリ
│   ├── sandbox/          # サンドボックスマネージャーとサービス
│   ├── storage.ts        # LocalStorage ユーティリティ
│   ├── rate-limit.ts     # API レート制限
│   └── notifications.ts  # トースト通知サービス
 ├── test/
 │   ├── helpers/          # 共有テストユーティリティ
 │   └── setup.ts          # Vitest グローバルセットアップ
 ├── types/                # TypeScript 型定義
 └── drizzle/              # データベースマイグレーション
```

## 主要機能の説明

### LocalStorage 永続化
アプリは以下の最後の使用内容を自動的に記憶します:
- リポジトリ URL
- リポジトリスラッグ
- フロントエンドディレクトリ
- プランファイルパス

これらは `/sandbox` に再度アクセスした際に復元されます。

### 共通設定
`COMMON_*` 環境変数を設定することで、以下の再入力を避けられます:
- GitHub トークン
- OpenCode 認証
- Gist URL

デフォルトがアクティブな場合、フィールドに「(共通設定を使用)」と表示されます。

### セッションのクローン
すべてのセッションはワンクリックでクローン可能:
- すべての非機密設定を保持
- 以前の値でフォームを自動入力
- すぐに変更して再実行可能

### セッションのアーカイブ
ワークスペースを整理:
- 履歴ページから完了したセッションをアーカイブ
- アーカイブされたセッションはデフォルトで非表示
- 必要に応じて簡単にアンアーカイブ可能

### Basic 認証
デプロイをパスワードで保護（オプション）:
- `BASIC_AUTH_USER` と `BASIC_AUTH_PASSWORD` 環境変数を設定
- 認証を有効にするには両方の値を設定する必要があります
- 認証が有効な場合、ログインページが表示されます
- セッションは localStorage に保持されます

## 開発

```bash
# 依存関係をインストール
pnpm install

# 開発サーバーを起動
pnpm run dev

# 本番用ビルド
pnpm run build

# 本番サーバーを起動
pnpm start

# コードをリント＆フォーマット（チェックモード）
pnpm run ci

# コードをリント＆フォーマット（書き込みモード）
pnpm run check

# 型チェック
pnpm run typecheck

# テストを実行
pnpm run test

# カバレッジ付きでテストを実行
pnpm test:coverage

# すべての CI チェックを実行（lint、typecheck、build、test）
pnpm run ci:all
```

## 継続的インテグレーション

このプロジェクトは GitHub Actions を使用した自動 CI チェックを行います。ワークフローは以下の場合に実行されます:
- `main`/`master` ブランチへのプッシュ
- `main`/`master` ブランチへのプルリクエスト

CI パイプラインには以下が含まれます:
1. **Lint** - Biome によるコード品質チェック
2. **Type Check** - TypeScript 型チェック
3. **Test** - Vitest によるユニットテスト
4. **Build** - Next.js 本番ビルド

完全な設定は `.github/workflows/ci.yml` を参照してください。

## デプロイ

### Vercel へデプロイ（推奨）

1. コードを GitHub にプッシュ
2. プロジェクトを Vercel にインポート
3. Vercel ダッシュボードで環境変数を設定:
   - `DATABASE_URL`
   - `COMMON_GITHUB_TOKEN`（オプション）
   - `COMMON_OPENCODE_AUTH_JSON_B64`（オプション）
   - `COMMON_GIST_URL`（オプション）
   - `COMMON_MODEL_PROVIDER`（オプション）
   - `COMMON_MODEL_ID`（オプション）
   - `BASIC_AUTH_USER`（オプション、パスワード保護用）
   - `BASIC_AUTH_PASSWORD`（オプション、パスワード保護用）
4. デプロイ！

`VERCEL_OIDC_TOKEN` は本番環境で Vercel により自動的に設定されます。

## ライセンス

MIT

## コントリビューション

コントリビューションを歓迎します！Issue を開くか、プルリクエストを送信してください。
