# GitHub 連携(リポジトリ/ブランチ選択) 実装レビュー(WIP)

対象: 現在の作業ツリー差分 (`feature/github_integration` の未コミット変更)

## 変更の狙い(把握)

- GitHub 認証セッションを使って、ユーザーがアクセス可能なリポジトリ一覧/ブランチ一覧を UI から選べるようにする
- サンドボックス作成時の `GITHUB_TOKEN` を「フォーム入力」ではなく「GitHub セッション(優先) / サーバー環境変数(フォールバック)」から供給する
- `COMMON_GITHUB_TOKEN` を `/api/config` から返さないことで、トークン露出リスクを下げる

該当ファイル例:

- `app/api/github/repos/route.ts`
- `app/api/github/repos/[owner]/[repo]/branches/route.ts`
- `hooks/use-github-repos.ts`
- `hooks/use-github-branches.ts`
- `components/sandbox/config-form/RepositorySection.tsx`
- `app/api/sandbox/create/route.ts`
- `app/api/auth/github/route.ts`

## 良い点

- `COMMON_GITHUB_TOKEN` をクライアントへ返さない方針は妥当 (`app/api/config/route.ts`)
- 作成 API 側で GitHub トークンの供給元をサーバー寄りに寄せたのは安全性/UX ともに改善 (`app/api/sandbox/create/route.ts`)
- リポジトリ選択で `repoUrl`/`repoSlug`/`baseBranch` を自動補完する設計は入力ミスを減らせる (`components/sandbox/config-form/RepositorySection.tsx`)
- API 返却型を `GitHubRepoResponse`/`GitHubBranchResponse` として整形している点はフロント実装が読みやすい

## 優先度高: 修正推奨

### 1) `radix-ui` パッケージの採用/インポートが危険

- `components/ui/popover.tsx` / `components/ui/select.tsx` / `components/ui/dialog.tsx` で `import { ... } from 'radix-ui'` になっていますが、一般的な Radix UI は `@radix-ui/react-popover` 等の個別パッケージです。
- `package.json` に `radix-ui` が追加されていますが、意図した公式パッケージではない可能性が高く、ビルド/型/サイズ/セキュリティ面でリスクです。

推奨:

- `@radix-ui/react-dialog` / `@radix-ui/react-popover` / `@radix-ui/react-select` を使用し、`radix-ui` 依存を削除
- 既存の shadcn/ui の導入方針に揃える

### 2) shadcn/ui コンポーネントのコードスタイルがリポジトリ規約と不整合

- `components/ui/command.tsx` などがダブルクォート・セミコロン無し・export 形式などで、Biome/既存コード規約(シングルクォート、import order など)とズレています。
- このままだと `pnpm lint` / `pnpm ci` で落ちる可能性が高いです。

推奨:

- `pnpm check` で整形し、必要なら手直し
- import order を `AGENTS.md` に合わせる

### 3) `requireGitHubSession()` の `redirect()` を API Route で使うのは挙動が不安定

- `app/api/sandbox/create/route.ts` で `requireGitHubSession('/sandbox')` を呼んでいますが、`lib/auth/require-github-session.ts` は `next/navigation` の `redirect()` を使います。
- `fetch('/api/sandbox/create')` で 30x が返る/例外になる/HTML が返って JSON parse が壊れる、などが起きやすく、クライアントのエラーハンドリングが不安定になります。

推奨:

- API Route 用に「リダイレクトしない」版(例: `getGitHubSessionFromCookiesOrNull`)を用意し、未認証は `401` + `loginUrl` を JSON で返す
- 画面側でログイン導線を出す(ボタン/リンク)

### 4) `RepositorySection` のブランチ `Select` が非制御で、フォーム状態とズレる可能性

- `Select` に `defaultValue={field.value}` を渡していますが、これは初期値固定になりやすいです。
- `setValue('baseBranch', ...)` で更新しても UI 表示が追従しないケースが出ます。

推奨:

- `value={field.value}` を使った制御コンポーネント化(react-hook-form と整合)

## 優先度中: 改善すると良い

### 5) リポジトリ/ブランチ API の認証処理が重複

- `app/api/github/repos/route.ts` と `app/api/github/repos/[owner]/[repo]/branches/route.ts` で Cookie decode〜session 取得が重複しています。

推奨:

- 共通ユーティリティ化(例: `getGitHubSessionOrThrow()` / `getGitHubSessionOrResponse()`)
- ログ出力も統一(開発時のみ log など)

### 6) GitHub API の rate limit / ページング / キャッシュ

- `/user/repos` と `/repos/{owner}/{repo}/branches` は頻繁に叩くと rate limit に当たりやすいです。
- `per_page` をクエリで受け取れますが、上限チェックがありません。

推奨:

- `per_page` を 1..100 に clamp
- Next の `fetch` オプションで `cache`/`revalidate` を検討
- クライアント側は TanStack Query に寄せてキャッシュ・再試行・staleTime を付ける

### 7) UI 文言の統一(日本語)

- API のエラーメッセージは日本語ですが、`RepositorySection` の UI 文言は英語です。
- `AGENTS.md` の方針(「UI text は日本語」)に合わせるなら文言統一を推奨します。

該当例:

- `components/sandbox/config-form/RepositorySection.tsx` の `Select repository` / `Loading repositories...` など

### 8) 初期値/編集時の復元

- フォームに既存値(`defaultValues`)が入っている場合、`selectedRepo` が `null` のままだとブランチ選択が無効化されやすいです。

推奨:

- `repoUrl`/`repoSlug`/`repos` の揃い具合から `selectedRepo` を復元する `useEffect` を追加
- 失敗した場合は手入力フォールバックを出す

## 優先度低: 気になった点(好み/将来)

- `app/api/sandbox/create/route.ts` の `console.log` は本番ログに残るので、既存の方針(dev のみ)に寄せると良い
- GitHub OAuth scope が `read:user repo` になっていますが、組織リポジトリの見え方によっては `read:org` が必要になる場合があります (`app/api/auth/github/route.ts`)

## 次のアクション案

1. `radix-ui` をやめ、`@radix-ui/react-*` に差し替え + `pnpm check` で整形
2. API Route で `redirect()` を使わない形にリファクタし、未認証時の JSON 仕様を決める
3. `RepositorySection` の `Select` を制御化 + 初期値復元 + 失敗時フォールバック UI
4. `useGitHubRepos`/`useGitHubBranches` を TanStack Query 化してキャッシュ/再試行/レート制御
