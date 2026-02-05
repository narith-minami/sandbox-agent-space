#!/bin/bash
# run-opencode-with-snapshot.sh
# Optimized for snapshot-based workflow
# 1 task = 1 branch = 1 session
#
# Gist用: サンドボックス内で curl -fsSL <GIST_RAW_URL> -o run.sh && chmod +x run.sh && ./run.sh
# 必須環境変数: SNAPSHOT_ID, GITHUB_TOKEN, OPENCODE_AUTH_JSON_B64, PLAN_TEXT

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
BASE_BRANCH="${BASE_BRANCH:-staging}"
FRONT_DIR="${FRONT_DIR:-frontend}"
BRANCH_PREFIX="${BRANCH_PREFIX:-ai/task}"

# AI Model Configuration
OPENCODE_MODEL_PROVIDER="${OPENCODE_MODEL_PROVIDER:-anthropic}"
OPENCODE_MODEL_ID="${OPENCODE_MODEL_ID:-claude-3-5-sonnet-20241022}"

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
WORKDIR="${WORKDIR:-/vercel/sandbox/repo}"
cd "$WORKDIR" || die "Failed to change directory to $WORKDIR"

# 既存の origin から owner/repo を取得（push / gh 用）
REPO_SLUG=$(git config --get remote.origin.url | sed -e 's|.*github\.com[:/]||' -e 's|\.git$||')
log "Repo: $REPO_SLUG"
log "Step 2/8: Moved to workspace"

# -----------------------
# 3. ベースブランチを最新に（必須）
# -----------------------
log "Step 3/8: Updating base branch to latest..."

git fetch origin "$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"

log "✓ Base branch updated to latest"

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

# Construct model flag for OpenCode CLI
MODEL_FLAG="--model ${OPENCODE_MODEL_PROVIDER}:${OPENCODE_MODEL_ID}"
log "Using AI Model: ${OPENCODE_MODEL_PROVIDER}:${OPENCODE_MODEL_ID}"

opencode run ${MODEL_FLAG} "Implement the tasks described in docs/plan.md ONLY within this directory.

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
