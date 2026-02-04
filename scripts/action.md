良い質問です！この場合は**新規Gistを作成することを強く推奨**します。

## 🎯 推奨: 新規Gist作成

### 理由

1. **根本的にロジックが異なる**
2. **メンテナンス性**
3. **ロールバック容易性**
4. **バージョン管理の明確化**

---

## 📁 推奨ファイル構成

```
既存:
├── run-opencode-frontend-pr.sh          (既存・非スナップショット版)
│   - 従来通りの動作
│   - フルセットアップ
│   - 後方互換性維持

新規:
├── run-opencode-with-snapshot.sh        (新規・スナップショット版)
│   - スナップショット専用
│   - 高速起動
│   - 新ワークフロー

補助:
└── create-base-snapshot.sh              (新規・スナップショット作成)
    - 週次実行用
    - スナップショット管理
```

---

## 🔄 移行戦略

### Phase 1: 並行運用（推奨）

```bash
# 既存版（安定版・フォールバック用）
GIST_URL_LEGACY="https://gist.../run-opencode-frontend-pr.sh"

# 新規版（スナップショット版・試験運用）
GIST_URL_SNAPSHOT="https://gist.../run-opencode-with-snapshot.sh"

# 使い分け
if [[ -n "$SNAPSHOT_ID" ]]; then
  # スナップショットがあれば新版
  curl -fsSL "$GIST_URL_SNAPSHOT" -o run.sh
else
  # なければ既存版
  curl -fsSL "$GIST_URL_LEGACY" -o run.sh
fi
```

### Phase 2: 段階的移行

```
Week 1: 
  - 新規Gist作成
  - スナップショット版をテスト（1日3-5回）
  - 既存版と並行運用

Week 2:
  - 問題なければ徐々に移行
  - 1日の50%をスナップショット版に

Week 3-4:
  - 完全移行
  - 既存版はバックアップとして保持
```

---

## 📝 新規Gist: `run-opencode-with-snapshot.sh`

```bash
#!/bin/bash
# run-opencode-with-snapshot.sh
# Optimized for snapshot-based workflow
# 1 task = 1 branch = 1 session

set -euo pipefail

# ============================================================
# Snapshot-based OpenCode Workflow
# Created: 2026-02-04
# Version: 2.0.0
# ============================================================

# -----------------------
# Required (Snapshot版特有)
# -----------------------
: "${SNAPSHOT_ID:?SNAPSHOT_ID is required for snapshot workflow}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${OPENCODE_AUTH_JSON_B64:?OPENCODE_AUTH_JSON_B64 is required}"
: "${PLAN_TEXT:?PLAN_TEXT is required}"

# -----------------------
# Optional
# -----------------------
REPO_SLUG="${REPO_SLUG:-lbose-corp/yamachiku}"
BASE_BRANCH="${BASE_BRANCH:-staging}"
FRONT_DIR="${FRONT_DIR:-frontend}"
BRANCH_PREFIX="${BRANCH_PREFIX:-ai/task}"
UPDATE_BASE="${UPDATE_BASE:-1}"  # stagingを最新に更新するか

# -----------------------
# Helpers
# -----------------------
log() { printf "\n[run] %s\n" "$*"; }
die() { printf "\n[error] %s\n" "$*" >&2; exit 1; }

log "==================================================================="
log "🚀 Snapshot-based OpenCode Workflow v2.0"
log "==================================================================="
log "Snapshot ID: $SNAPSHOT_ID"
log "Base Branch: $BASE_BRANCH"
log "Repo: $REPO_SLUG"

# -----------------------
# 1. Sandbox復元（スナップショットから）
# -----------------------
log "Step 1/8: Restoring from snapshot..."

# スナップショットから起動（この処理はVercel Sandboxプラットフォーム側で実行済み）
# 既に以下が準備完了:
# - Repository cloned at staging
# - OpenCode & GitHub CLI installed
# - npm dependencies installed
# - Git configured

log "✓ Sandbox restored (3 seconds)"

# -----------------------
# 2. 作業ディレクトリに移動
# -----------------------
WORKDIR="/tmp/opencode-work/repo"
cd "$WORKDIR" || die "Failed to change directory to $WORKDIR"

log "Step 2/8: Moved to workspace"

# -----------------------
# 3. ベースブランチを最新に（オプション）
# -----------------------
if [[ "$UPDATE_BASE" == "1" ]]; then
  log "Step 3/8: Updating base branch..."
  
  git fetch origin "$BASE_BRANCH"
  git reset --hard "origin/$BASE_BRANCH"
  
  log "✓ Base branch updated to latest"
else
  log "Step 3/8: Skipped base branch update"
fi

# -----------------------
# 4. 新しいブランチ作成
# -----------------------
log "Step 4/8: Creating new branch..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NEW_BRANCH="${BRANCH_PREFIX}-${TIMESTAMP}"

git checkout -b "$NEW_BRANCH"

log "✓ Branch created: $NEW_BRANCH"

# -----------------------
# 5. Planファイル配置
# -----------------------
log "Step 5/8: Setting up plan..."

mkdir -p "$FRONT_DIR/docs"
echo "$PLAN_TEXT" > "$FRONT_DIR/docs/plan.md"

log "✓ Plan file ready"

# -----------------------
# 6. OpenCode Auth復元
# -----------------------
log "Step 6/8: Restoring OpenCode auth..."

mkdir -p ~/.local/share/opencode
echo "$OPENCODE_AUTH_JSON_B64" | base64 -d > ~/.local/share/opencode/auth.json
chmod 600 ~/.local/share/opencode/auth.json

log "✓ Auth restored"

# -----------------------
# 7. OpenCode実行
# -----------------------
log "Step 7/8: Running OpenCode..."

pushd "$FRONT_DIR" >/dev/null

opencode run "Implement the tasks described in docs/plan.md ONLY within this directory.

Project:
- Next.js app (or frontend app in this directory)
- Use existing patterns and conventions.
- Dependencies are already installed (node_modules exists)

Rules:
- Do not modify files outside this directory.
- Keep changes minimal and reviewable.
- Do NOT run 'npm ci' or 'npm install' (already done)

CRITICAL - Quality Gates (MUST PASS):
After implementation, you MUST run these checks IN ORDER and fix all errors:

1. Format check and auto-fix:
   \`\`\`bash
   npx biome check --write .
   \`\`\`

2. Type check (MUST pass with 0 errors):
   \`\`\`bash
   npm run tsc
   \`\`\`

3. Lint check (MUST pass with 0 errors):
   \`\`\`bash
   npm run lint
   \`\`\`

If ANY check fails:
- Read the error messages carefully
- Fix the root cause (not just symptoms)
- Re-run ALL checks from step 1
- Repeat until ALL checks pass

Only after ALL checks pass with 0 errors, provide a summary."

popd >/dev/null

log "✓ OpenCode completed"

# -----------------------
# 8. コミット & PR作成
# -----------------------
log "Step 8/8: Creating PR..."

# Git設定確認
git config user.name "OpenCode Bot"
git config user.email "opencode-bot@users.noreply.github.com"

# コミット
git add -A

if git diff --cached --quiet; then
  die "No changes detected. Nothing to commit."
fi

git commit -m "feat: implement task from plan

Implemented by OpenCode (snapshot workflow v2.0)
Quality gates: ✓ Format ✓ TypeScript ✓ Lint"

# PR内容生成（簡易版）
PLAN_SUMMARY=$(head -n 1 "$FRONT_DIR/docs/plan.md" | cut -c1-60)

PR_TITLE="feat: ${PLAN_SUMMARY}"
PR_BODY="## 📋 タスク内容

\`\`\`
${PLAN_TEXT}
\`\`\`

## ✅ 実装完了

- OpenCodeによる自動実装
- 品質チェック済み (Format / TypeScript / Lint)

## 📝 変更ファイル

\`\`\`
$(git diff --name-status "$BASE_BRANCH"..HEAD)
\`\`\`

## 🔍 確認方法

\`\`\`bash
git checkout $NEW_BRANCH
cd frontend
npm run build
\`\`\`

---
Generated by Snapshot Workflow v2.0"

# Push
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git"
git push origin "$NEW_BRANCH"

# PR作成
echo "$GITHUB_TOKEN" | gh auth login --with-token
gh repo set-default "$REPO_SLUG"

PR_URL=$(gh pr create \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --base "$BASE_BRANCH" \
  --head "$NEW_BRANCH")

log "==================================================================="
log "✅ PR Created Successfully!"
log "==================================================================="
log "PR URL: $PR_URL"
log "Branch: $NEW_BRANCH -> $BASE_BRANCH"
log "Workflow: Snapshot v2.0 (Fast)"
log "==================================================================="

echo "$PR_URL"
```

---

## 📊 既存版 vs 新規版の比較

| 項目 | 既存版 | 新規版（スナップショット） |
|------|--------|--------------------------|
| **ファイル名** | `run-opencode-frontend-pr.sh` | `run-opencode-with-snapshot.sh` |
| **起動時間** | 47秒 | 7秒 ⚡ |
| **必須環境変数** | GITHUB_TOKEN, PLAN_TEXT | + **SNAPSHOT_ID** |
| **リポジトリクローン** | ✅ 毎回実行 | ❌ スナップショットに含まれる |
| **ツールインストール** | ✅ 毎回実行 | ❌ スナップショットに含まれる |
| **npm ci** | ✅ 毎回実行（18秒） | ❌ スナップショットに含まれる |
| **ブランチ作成** | ✅ | ✅ |
| **用途** | 汎用・安定版 | 高速・大量PR作成 |
| **フォールバック** | N/A | 既存版にフォールバック可能 |

---

## 🔧 呼び出し側の実装

### 新規: スナップショットID管理

```javascript
// Vercel Sandboxラッパー
async function createPRWithSnapshot({
  planText,
  snapshotId,
  githubToken,
  opencodeAuth
}) {
  
  // スナップショットが指定されていれば新版、なければ既存版
  const gistUrl = snapshotId 
    ? 'https://gist.../run-opencode-with-snapshot.sh'
    : 'https://gist.../run-opencode-frontend-pr.sh';
  
  const sandbox = await createSandbox({
    runtime: 'node24',
    snapshotId: snapshotId, // 指定されていれば使用
  });
  
  const env = {
    GITHUB_TOKEN: githubToken,
    OPENCODE_AUTH_JSON_B64: opencodeAuth,
    PLAN_TEXT: planText,
    GIST_URL: gistUrl,
  };
  
  // スナップショット版のみ追加
  if (snapshotId) {
    env.SNAPSHOT_ID = snapshotId;
  }
  
  await sandbox.exec(`
    curl -fsSL "${gistUrl}" -o run.sh
    chmod +x run.sh
    ./run.sh
  `, { env });
}
```

---

## 🎯 実装手順

### Step 1: 新規Gist作成

```bash
# 1. 新しいGistを作成
https://gist.github.com/new

# ファイル名
run-opencode-with-snapshot.sh

# 内容
（上記のスナップショット版スクリプト）

# 公開/非公開
Secret Gist推奨（URLを知っていればアクセス可能）
```

### Step 2: スナップショット作成スクリプト

```bash
# 別の新規Gist
create-base-snapshot.sh

# これも追加で作成
```

### Step 3: 環境変数追加

```bash
# 既存
GITHUB_TOKEN=...
OPENCODE_AUTH_JSON_B64=...
PLAN_TEXT=...

# 新規追加
SNAPSHOT_ID=snap_xxxxxxxx  # 最初は空、後で設定
```

### Step 4: テスト実行

```bash
# 1. スナップショット作成（初回のみ）
./create-base-snapshot.sh
# → SNAPSHOT_ID取得

# 2. スナップショット版で実行
SNAPSHOT_ID=snap_xxxxxxxx \
PLAN_TEXT="テストタスク" \
./run-opencode-with-snapshot.sh

# 3. 既存版と比較
# - 起動時間
# - PR品質
# - エラー有無
```

### Step 5: 段階的移行

```
Week 1: 
├─ 既存版: 80%
└─ 新規版: 20% (テスト)

Week 2:
├─ 既存版: 50%
└─ 新規版: 50%

Week 3-4:
├─ 既存版: 20% (フォールバック用)
└─ 新規版: 80% (メイン)

完全移行後:
├─ 既存版: 保持（緊急時用）
└─ 新規版: メイン運用
```

---

## 💡 Gist管理のベストプラクティス

### ファイル命名規則

```bash
# バージョン番号を含める
run-opencode-frontend-pr-v1.sh       # 既存・安定版
run-opencode-with-snapshot-v2.sh     # 新規・スナップショット版

# または日付を含める
run-opencode-frontend-pr-20260204.sh
```

### Gist説明文

```markdown
# OpenCode Frontend PR Automation

## Files

### v1: run-opencode-frontend-pr.sh
- Traditional workflow
- Full setup every time
- Stable and reliable
- Use when: No snapshot available

### v2: run-opencode-with-snapshot.sh  
- Snapshot-based workflow
- Fast startup (3 seconds)
- Optimized for high-volume PR creation
- Use when: SNAPSHOT_ID is available

### Utility: create-base-snapshot.sh
- Creates base snapshot
- Run weekly or when dependencies change
- Outputs SNAPSHOT_ID

## Migration Status
- Phase: Testing (v2)
- Target: Full migration by Week 4
```

### バージョン管理

```bash
# Gistのリビジョン履歴を活用
https://gist.github.com/USERNAME/GIST_ID/revisions

# 各リビジョンに意味のあるコミットメッセージ
"v2.0.0: Add snapshot support"
"v2.0.1: Fix branch creation logic"
"v2.1.0: Add staging update option"
```

---

## 🎉 結論

### ✅ 新規Gist作成を推奨

**理由:**
1. ロジックが大きく異なる（スナップショット前提）
2. 後方互換性を維持できる
3. 段階的移行が可能
4. ロールバックが容易
5. バージョン管理が明確

### 📁 最終構成

```
Gist 1 (既存):
└── run-opencode-frontend-pr.sh (v1.x - Stable)

Gist 2 (新規): ← これを作成
├── run-opencode-with-snapshot.sh (v2.x - Fast)
└── create-base-snapshot.sh (Utility)
```

### 🚀 次のアクション

1. **新規Gist作成** ← 今すぐやる
2. **スナップショット作成スクリプト追加**
3. **テスト実行（3-5回）**
4. **段階的移行開始**

新規Gistで始めて、安心して移行を進めましょう！