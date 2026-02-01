# セキュリティ脆弱性分析レポート

**対象システム**: Sandbox Agent Space (Next.js 16 / Vercel Sandbox SDK)
**分析日**: 2026-02-01
**リスクレベル**: Critical / High / Medium / Low / Info

---

## 目次

1. [エグゼクティブサマリー](#1-エグゼクティブサマリー)
2. [Critical - クリティカルリスク](#2-critical---クリティカルリスク)
3. [High - 高リスク](#3-high---高リスク)
4. [Medium - 中リスク](#4-medium---中リスク)
5. [Low - 低リスク](#5-low---低リスク)
6. [Info - 情報・改善提案](#6-info---情報改善提案)
7. [実装済みセキュリティ対策](#7-実装済みセキュリティ対策)

---

## 1. エグゼクティブサマリー

本システムは、Vercel Sandbox SDK を利用してコーディングエージェントを隔離された microVM 内で実行する Web アプリケーションである。入力バリデーション（Zod）、レートリミット（Upstash Redis）、ORM によるパラメタライズドクエリなど基本的なセキュリティ対策は実装されているが、**認証・認可の欠如**、**クレデンシャルの API 経由での露出**、**任意スクリプト実行**など、複数の重大な脆弱性が存在する。

| レベル | 件数 |
|--------|------|
| Critical | 2 |
| High | 4 |
| Medium | 4 |
| Low | 3 |

---

## 2. Critical - クリティカルリスク

### 2.1 API エンドポイントによるクレデンシャル露出

- **該当箇所**: `app/api/config/route.ts:13-21`
- **CVSS 想定**: 9.1 (Critical)
- **CWE**: CWE-200 (Information Exposure)

**詳細**: `/api/config` エンドポイントが、環境変数に設定された `COMMON_GITHUB_TOKEN` および `COMMON_OPENCODE_AUTH_JSON_B64` を**認証なしで**そのまま JSON レスポンスとして返却している。

```typescript
// app/api/config/route.ts
export async function GET() {
  const config: CommonConfig = {
    githubToken: process.env.COMMON_GITHUB_TOKEN,         // GitHub PAT が平文で返却
    opencodeAuthJsonB64: process.env.COMMON_OPENCODE_AUTH_JSON_B64, // 認証情報が平文で返却
    gistUrl: process.env.COMMON_GIST_URL,
  };
  return NextResponse.json(config);
}
```

**影響**: インターネット上の誰もが `GET /api/config` にアクセスするだけで GitHub トークンと OpenCode 認証情報を窃取可能。これにより、リポジトリへの不正アクセス、コードの改ざん、サプライチェーン攻撃が可能になる。

**推奨対策**:
- このエンドポイントからクレデンシャルを完全に除去する
- クレデンシャルはサーバーサイドでのみ使用し、フロントエンドには公開しない
- 必要であれば認証済みユーザーにのみ、マスク済みの値（`ghp_****xxxx`）を返す

---

### 2.2 認証・認可機構の完全な欠如

- **該当箇所**: 全 API エンドポイント
- **CVSS 想定**: 9.8 (Critical)
- **CWE**: CWE-306 (Missing Authentication for Critical Function)

**詳細**: すべての API エンドポイントに**ユーザー認証が存在しない**。Sandbox の作成、ログの閲覧、セッションの停止、スナップショットの作成・削除など、すべての操作が認証なしで実行可能。

**影響**:
- 任意のユーザーが Sandbox を作成し、Vercel リソースを消費（課金攻撃）
- 他ユーザーのセッション ID を推測または列挙して、ログ・設定情報を閲覧
- 他ユーザーの実行中 Sandbox を停止・スナップショット化
- セッション一覧 (`GET /api/sessions`) から全ユーザーの情報を取得

**推奨対策**:
- 認証ミドルウェア（NextAuth.js、Clerk、Auth0 等）を導入する
- 各エンドポイントで認証・認可チェックを実施する
- セッションにユーザー ID を紐づけ、Row-Level Security を実装する

---

## 3. High - 高リスク

### 3.1 任意スクリプトのダウンロード・実行 (Remote Code Execution via Gist)

- **該当箇所**: `lib/sandbox/manager.ts:176-208`
- **CVSS 想定**: 8.1 (High)
- **CWE**: CWE-94 (Improper Control of Generation of Code)

**詳細**: ユーザーが指定した Gist URL から任意のシェルスクリプトをダウンロードし、Sandbox 内で実行する。Gist URL のバリデーションは `gist.githubusercontent.com` または `gist.github.com` のホスト名チェックのみで、**スクリプトの内容は一切検証されない**。

```typescript
// Gist からスクリプトをダウンロードして実行
const downloadResult = await sandbox.runCommand('curl', ['-fsSL', options.env.GIST_URL, '-o', 'run.sh']);
await sandbox.runCommand('chmod', ['+x', 'run.sh']);
// さらに bash -c でコマンド全体を実行
const command = await sandbox.runCommand({
  cmd: 'bash',
  args: ['-c', options.command],
  env: options.env,
});
```

**影響**: Sandbox は microVM による隔離があるため直接のホスト侵害リスクは低いが、以下の攻撃が可能:
- Sandbox 内で渡された `GITHUB_TOKEN` を使い、リポジトリへの悪意あるコミットの push
- `OPENCODE_AUTH_JSON_B64` を外部に送信するスクリプトの実行
- Sandbox のネットワークアクセスを利用した内部サービスへのプロービング

**推奨対策**:
- 許可された Gist URL のホワイトリストを運用する
- スクリプトの署名検証またはハッシュチェックを導入する
- Sandbox のネットワークアクセスを必要最小限に制限する

---

### 3.2 レートリミットのフェイルオープン

- **該当箇所**: `lib/rate-limit.ts:38-45`, `lib/rate-limit.ts:84-91`
- **CVSS 想定**: 7.5 (High)
- **CWE**: CWE-770 (Allocation of Resources Without Limits)

**詳細**: Redis が未設定または接続エラー時に、レートリミットが**完全にバイパス**される（フェイルオープン）。

```typescript
// Redis 未設定時
if (!redis) {
  return { success: true, remaining: maxRequests, reset: windowSeconds };
}

// Redis エラー時
catch (error) {
  console.error('Rate limit check failed:', error);
  return { success: true, remaining: maxRequests, reset: windowSeconds };
}
```

**影響**: Redis が利用不可の場合、攻撃者は無制限に Sandbox を作成でき、以下のリスクが生じる:
- Vercel Sandbox リソースの大量消費（課金攻撃）
- データベースへの大量書き込みによる DoS
- 他の正規ユーザーのサービス利用を妨害

**推奨対策**:
- インメモリフォールバック（Map ベースの簡易カウンター）を実装する
- Redis 障害時はリクエストを拒否（フェイルクローズ）するオプションを提供する
- Redis の健全性監視アラートを設定する

---

### 3.3 CORS ワイルドカード設定

- **該当箇所**: `vercel.json:10-28`
- **CVSS 想定**: 7.4 (High)
- **CWE**: CWE-942 (Permissive Cross-domain Policy)

**詳細**: 全 API ルートに対して `Access-Control-Allow-Origin: *` が設定されている。

```json
{
  "key": "Access-Control-Allow-Origin",
  "value": "*"
}
```

**影響**: 任意のドメインから API を呼び出し可能。認証がない現状と組み合わせると、悪意あるウェブサイトからのクロスオリジンリクエストによって、Sandbox 作成、クレデンシャル取得、セッション情報の窃取が可能。

**推奨対策**:
- 許可するオリジンを明示的に指定する（例: `https://your-app.vercel.app`）
- `Access-Control-Allow-Credentials: true` を使用する場合はワイルドカード禁止

---

### 3.4 IP スプーフィングによるレートリミットバイパス

- **該当箇所**: `lib/rate-limit.ts:108-120`
- **CVSS 想定**: 7.3 (High)
- **CWE**: CWE-290 (Authentication Bypass by Spoofing)

**詳細**: クライアント IP の取得に `X-Forwarded-For` ヘッダーを使用しているが、このヘッダーはクライアントが自由に設定可能。

```typescript
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim(); // クライアントが偽装可能
  }
  // ...
}
```

**影響**: 攻撃者は `X-Forwarded-For` ヘッダーを毎回変更することで、レートリミットを完全にバイパス可能。

**推奨対策**:
- Vercel のプラットフォームが設定する信頼できるヘッダーのみを使用する
- 複数のシグナル（IP + API キー + フィンガープリント）でレートリミットを実施する

---

## 4. Medium - 中リスク

### 4.1 セッション ID の列挙によるデータ漏洩 (IDOR)

- **該当箇所**: 全 `[sessionId]` エンドポイント、`app/api/sessions/route.ts`
- **CVSS 想定**: 6.5 (Medium)
- **CWE**: CWE-639 (Authorization Bypass Through User-Controlled Key)

**詳細**: セッション ID は UUID v4 であり推測は困難だが、`GET /api/sessions` エンドポイントが**全セッションの一覧を認証なしで返却**するため、有効なセッション ID を容易に取得可能。取得した ID を使い、任意のセッションのログ、設定、ステータスにアクセスできる。

**推奨対策**:
- セッション一覧にユーザーフィルターを適用する
- 各リソースアクセス時にオーナーシップチェックを実施する

---

### 4.2 エラーメッセージによる内部情報の漏洩

- **該当箇所**: `app/api/sandbox/create/route.ts:145-164`
- **CVSS 想定**: 5.3 (Medium)
- **CWE**: CWE-209 (Generation of Error Message Containing Sensitive Information)

**詳細**: エラー発生時に `error.message` をそのままレスポンスに含めている。これにより、内部のスタック情報、データベース構造、認証方式などが外部に漏洩する可能性がある。

```typescript
const errorMessage = error instanceof Error ? error.message : 'Unknown error';
return NextResponse.json<ApiError>({
  error: 'Failed to create sandbox',
  code: 'INTERNAL_ERROR',
  details: { message: errorMessage },  // 内部エラーの詳細が漏洩
}, { status: 500 });
```

**推奨対策**:
- 本番環境では汎用的なエラーメッセージのみを返す
- 詳細なエラーはサーバーサイドのログにのみ記録する

---

### 4.3 スナップショットへの認可なしアクセス

- **該当箇所**: `app/api/snapshots/`
- **CVSS 想定**: 6.5 (Medium)
- **CWE**: CWE-862 (Missing Authorization)

**詳細**: スナップショットの一覧取得、詳細表示、削除に認可チェックがない。スナップショット ID を知っていれば、他者のスナップショットからSandbox を復元でき、そのスナップショットに含まれる**ソースコード、環境変数、実行状態**にアクセス可能。

**推奨対策**:
- スナップショットにオーナー情報を付与する
- アクセス時にオーナーシップを検証する

---

### 4.4 設定情報の JSONB カラムへの格納

- **該当箇所**: `lib/db/schema.ts` (sessions テーブルの config カラム)
- **CVSS 想定**: 5.9 (Medium)
- **CWE**: CWE-312 (Cleartext Storage of Sensitive Information)

**詳細**: セッション作成時に `SandboxConfig` オブジェクトが JSONB としてデータベースに保存される。この config には `githubToken` や `opencodeAuthJsonB64` が含まれる可能性がある。`GET /api/sessions` や `GET /api/sandbox/[sessionId]` でセッション情報を返却する際に、これらが露出する。

**推奨対策**:
- クレデンシャルを config から除外してから保存する
- データベースに保存する際にクレデンシャルフィールドをマスクする
- レスポンス返却前にサニタイズする

---

## 5. Low - 低リスク

### 5.1 SSE ストリームのリソース枯渇

- **該当箇所**: `lib/sandbox/manager.ts:399-430`
- **CVSS 想定**: 3.7 (Low)
- **CWE**: CWE-400 (Uncontrolled Resource Consumption)

**詳細**: ログストリーミングは最大 600 イテレーション（約 10 分間）データベースをポーリングする。多数のクライアントが同時に SSE 接続を開くと、サーバーレス関数のコネクション数およびデータベースクエリの負荷が増大する。

**推奨対策**:
- SSE 接続数に上限を設ける
- WebSocket やPub/Sub パターンへの移行を検討する

---

### 5.2 パストラバーサル防止の不完全性

- **該当箇所**: `lib/validators/config.ts:59-63`
- **CVSS 想定**: 3.1 (Low)
- **CWE**: CWE-22 (Improper Limitation of a Pathname to a Restricted Directory)

**詳細**: `frontDir` のパストラバーサルチェックは `..` の包含と `/` 始まりのみを検査している。URL エンコード(`%2e%2e`)、Unicode 正規化、シンボリックリンクによるバイパスは検証されていない。ただし Sandbox 内での実行のため、ホストへの影響は限定的。

**推奨対策**:
- `path.resolve()` で正規化してからベースパスとの比較を行う
- Sandbox SDK の内部制限と併用する

---

### 5.3 X-Auth-Method ヘッダーによる情報漏洩

- **該当箇所**: `app/api/sandbox/create/route.ts:137`
- **CVSS 想定**: 2.6 (Low)
- **CWE**: CWE-200 (Information Exposure)

**詳細**: レスポンスヘッダーに `X-Auth-Method` として認証方式（`oidc` / `access_token`）を返している。攻撃者がインフラ構成を推測する際の手がかりとなる。

**推奨対策**:
- 本番環境ではこのヘッダーを削除する

---

## 6. Info - 情報・改善提案

| # | 項目 | 説明 |
|---|------|------|
| 6.1 | 依存関係の管理 | `@vercel/sandbox`, `drizzle-orm`, `@neondatabase/serverless` 等の依存パッケージに対して、定期的な脆弱性スキャン（`npm audit`, Snyk, Dependabot）を実施すべき |
| 6.2 | ログの機密情報 | コマンドのログは 200 文字に切り詰められているが、stdout/stderr のログには制限がなく、スクリプト出力にトークンが含まれる場合に漏洩する |
| 6.3 | CSP ヘッダー | Content-Security-Policy ヘッダーが未設定。XSS 対策として導入を推奨 |
| 6.4 | HTTPS 強制 | Vercel プラットフォームで自動適用されるが、HSTS ヘッダーの明示的設定を推奨 |
| 6.5 | 監査ログ | セッション作成・停止・スナップショット等の操作に対する監査ログ機構がない。コンプライアンス対応のため導入を推奨 |
| 6.6 | シークレット管理 | 環境変数で直接管理されているクレデンシャルを Vault（HashiCorp Vault, AWS Secrets Manager 等）に移行することを推奨 |

---

## 7. 実装済みセキュリティ対策

本システムで既に実装されている対策を以下に整理する。

| 対策 | 実装箇所 | 評価 |
|------|---------|------|
| 入力バリデーション (Zod) | `lib/validators/config.ts` | 良好 - URL、トークン形式、パスを検証 |
| パラメタライズドクエリ (Drizzle ORM) | `lib/db/queries.ts` | 良好 - SQLインジェクション対策 |
| レートリミット (Upstash Redis) | `lib/rate-limit.ts` | 部分的 - フェイルオープンが課題 |
| Sandbox 隔離 (Vercel microVM) | `lib/sandbox/manager.ts` | 良好 - コード実行はホストから隔離 |
| パストラバーサル防止 | `lib/validators/config.ts` | 部分的 - 基本的なチェックのみ |
| クレデンシャルのログ除外 | `lib/sandbox/manager.ts` | 部分的 - env キー名のみログ |
| GitHub URL 制限 | `lib/validators/config.ts` | 良好 - ホスト名チェック実施 |
| UUID によるセッション識別 | `lib/validators/config.ts` | 良好 - 推測困難な識別子 |

---

> **本レポートは静的コード分析に基づくものであり、動的テスト（ペネトレーションテスト）の結果は含まれていません。**
> **実際の攻撃可能性は、デプロイ環境・ネットワーク構成・Vercel プラットフォームの保護機能により異なります。**
