# Sandbox 利用時の Gist スクリプト

サンドボックス（Vercel Sandbox）内で実行するための Gist 用スクリプトです。

## ファイル一覧

| ファイル | 用途 | Gist にアップロード |
|----------|------|----------------------|
| `run-opencode-with-snapshot.sh` | スナップショットから復元したサンドボックスで OpenCode を実行し PR を作成 | ✅ 推奨 |
| `create-base-snapshot.sh` | ベーススナップショット作成（週次など） | ✅ 推奨 |

## Gist の作成手順

1. https://gist.github.com/new で新規 Gist 作成
2. ファイル名: `run-opencode-with-snapshot.sh`（1つ目）、`create-base-snapshot.sh`（2つ目は「Add file」で追加）
3. 各ファイルの内容を本ディレクトリのスクリプトからコピー
4. Create secret gist（または Create public gist）

**Raw URL の取得**

- 各ファイルを開き「Raw」→ URL は  
  `https://gist.githubusercontent.com/<USER>/<GIST_ID>/raw/<FILE_SHA>/run-opencode-with-snapshot.sh`  
  または簡易に  
  `https://gist.githubusercontent.com/<USER>/<GIST_ID>/raw/run-opencode-with-snapshot.sh`  
  （最新はファイル名指定で取得できる場合あり）

## サンドボックス内での実行方法

### スナップショット版（run-opencode-with-snapshot.sh）

サンドボックス作成時に `snapshotId` を指定し、以下で実行します。

```bash
# 環境変数（必須）
export SNAPSHOT_ID="snap_xxxxxxxx"
export GITHUB_TOKEN="ghp_xxxx"
export OPENCODE_AUTH_JSON_B64="<base64 encoded auth.json>"
export PLAN_TEXT="タスク内容"

# オプション（任意）
export BASE_BRANCH="staging"
export FRONT_DIR="frontend"
export BRANCH_PREFIX="ai/task"

# Gist から取得して実行
curl -fsSL "https://gist.githubusercontent.com/<USER>/<GIST_ID>/raw/run-opencode-with-snapshot.sh" -o run.sh
chmod +x run.sh
./run.sh
```

### 呼び出し側（ホスト）の例

```javascript
const gistUrl = 'https://gist.githubusercontent.com/<USER>/<GIST_ID>/raw/run-opencode-with-snapshot.sh';

const sandbox = await createSandbox({
  runtime: 'node24',
  snapshotId: snapshotId,
});

await sandbox.exec(
  `curl -fsSL "${gistUrl}" -o run.sh && chmod +x run.sh && ./run.sh`,
  {
    env: {
      SNAPSHOT_ID: snapshotId,
      GITHUB_TOKEN: githubToken,
      OPENCODE_AUTH_JSON_B64: opencodeAuth,
      PLAN_TEXT: planText,
    },
  }
);
```

## 必須環境変数（run-opencode-with-snapshot.sh）

| 変数 | 説明 |
|------|------|
| `SNAPSHOT_ID` | 使用するスナップショット ID |
| `GITHUB_TOKEN` | GitHub PR 作成・push 用 |
| `OPENCODE_AUTH_JSON_B64` | OpenCode 認証情報（base64） |
| `PLAN_TEXT` | タスク内容（plan.md に書き込まれる） |

詳細は `action.md` を参照してください。
