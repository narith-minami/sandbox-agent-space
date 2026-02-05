なるほど！その使い方なら、スナップショット戦略を調整する必要があります。

## 🎯 あなたのユースケース

```
1タスク = 1ブランチ = 1セッション = 1PR

実行パターン:
- 1日に10-20個のタスク
- 各タスクで新しいブランチ作成
- stagingから分岐
- 実装 → PR → マージ
```

---

## 📸 最適なスナップショット戦略

### ✅ 推奨: "ベースブランチ直後"スナップショット

```
スナップショット内容:
✅ staging ブランチをクローン済み
✅ OpenCode & GitHub CLI インストール済み
✅ npm dependencies インストール済み
❌ 作業ブランチは未作成（これが重要！）

利用フロー:
1. スナップショットから起動 (3秒)
2. 新しいブランチ作成 (1秒)
3. Planファイル配置 (1秒)
4. OpenCode実行 → PR作成
```

---

## 🔧 実装例

### 1. スナップショット作成スクリプト

```bash
#!/bin/bash
# create-base-snapshot.sh
# staging直後の状態をスナップショット化

set -euo pipefail

log() { printf "[%s] %s\n" "$(date +'%H:%M:%S')" "$*"; }

REPO_URL="https://github.com/lbose-corp/yamachiku"
BASE_BRANCH="staging"
SNAPSHOT_NAME="yamachiku-staging-ready"

log "Creating base snapshot for daily PR workflow..."

# -----------------------
# Sandbox作成
# -----------------------
log "1. Creating sandbox..."
SANDBOX_ID=$(vercel_sandbox_create)

# -----------------------
# 環境セットアップ
# -----------------------
log "2. Setting up base environment..."

# リポジトリクローン（staging）
git clone "$REPO_URL" repo
cd repo
git checkout "$BASE_BRANCH"

log "✓ Repository cloned at staging branch"

# -----------------------
# ツールインストール（並列）
# -----------------------
log "3. Installing tools in parallel..."

(
  # OpenCode
  curl -L https://github.com/anomalyco/opencode/releases/download/v1.1.48/opencode-linux-x64.tar.gz \
    -o /tmp/opencode.tar.gz
  tar -xzf /tmp/opencode.tar.gz -C /tmp
  mv /tmp/opencode "$HOME/.local/bin/opencode"
  chmod +x "$HOME/.local/bin/opencode"
) &

(
  # GitHub CLI
  curl -L https://github.com/cli/cli/releases/download/v2.65.0/gh_2.65.0_linux_amd64.tar.gz \
    -o /tmp/gh.tar.gz
  tar -xzf /tmp/gh.tar.gz -C /tmp --strip-components=1
  mv /tmp/bin/gh "$HOME/.local/bin/gh"
  chmod +x "$HOME/.local/bin/gh"
) &

wait

log "✓ Tools installed"

# -----------------------
# 依存関係インストール
# -----------------------
log "4. Installing dependencies..."

cd frontend
npm ci --no-audit

log "✓ Dependencies installed"

# -----------------------
# OpenCode設定
# -----------------------
log "5. Configuring OpenCode..."

mkdir -p ~/.config/opencode
cat > ~/.config/opencode/opencode.json << "EOF"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "github-copilot/claude-opus-4.5",
  "small_model": "github-copilot/gpt-4o-mini",
  "enabled_providers": ["github-copilot"],
  "disabled_providers": ["openai", "opencode"]
}
EOF

log "✓ OpenCode configured"

# -----------------------
# Git設定
# -----------------------
log "6. Configuring Git..."

git config user.name "OpenCode Bot"
git config user.email "opencode-bot@users.noreply.github.com"

log "✓ Git configured"

# -----------------------
# スナップショット作成
# -----------------------
log "7. Creating snapshot..."

SNAPSHOT_ID=$(vercel_snapshot_create "$SANDBOX_ID" "$SNAPSHOT_NAME")

log "✅ Snapshot created successfully!"
log "   Snapshot ID: $SNAPSHOT_ID"
log "   Use this in your workflow config"

# スナップショットIDを保存
echo "$SNAPSHOT_ID" > snapshot-id.txt

cat << EOF

=============================================================================
✅ Base Snapshot Created
=============================================================================

Snapshot ID: $SNAPSHOT_ID

This snapshot contains:
- Repository cloned at 'staging' branch
- OpenCode v1.1.48 installed
- GitHub CLI v2.65.0 installed  
- npm dependencies installed
- Git configured

Ready for: Daily PR workflow (1 task = 1 branch = 1 session)

Next: Use this snapshot ID in your run script
=============================================================================

EOF
```

---

### 2. スナップショットを使った実行スクリプト

```bash
#!/bin/bash
# run-opencode-from-snapshot.sh
# スナップショットから起動して新ブランチでPR作成

set -euo pipefail

# -----------------------
# 環境変数
# -----------------------
: "${SNAPSHOT_ID:?SNAPSHOT_ID is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${OPENCODE_AUTH_JSON_B64:?OPENCODE_AUTH_JSON_B64 is required}"
: "${PLAN_TEXT:?PLAN_TEXT is required}"

REPO_SLUG="${REPO_SLUG:-lbose-corp/yamachiku}"
BASE_BRANCH="${BASE_BRANCH:-staging}"
FRONT_DIR="${FRONT_DIR:-frontend}"
BRANCH_PREFIX="${BRANCH_PREFIX:-ai/task}"

log() { printf "\n[run] %s\n" "$*"; }
die() { printf "\n[error] %s\n" "$*" >&2; exit 1; }

# -----------------------
# スナップショットから起動
# -----------------------
log "🚀 Starting from snapshot: $SNAPSHOT_ID"

SANDBOX_ID=$(create_sandbox_from_snapshot "$SNAPSHOT_ID")

log "✓ Sandbox ready in 3 seconds!"

# この時点で以下が準備済み:
# - リポジトリ (staging)
# - OpenCode & GitHub CLI
# - npm dependencies
# - Git設定

# -----------------------
# 作業ディレクトリに移動
# -----------------------
cd /workspace/repo  # スナップショット内のパス

# -----------------------
# 最新のstagingを取得（オプション）
# -----------------------
log "Updating staging branch..."
git fetch origin "$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"

log "✓ Up to date with remote staging"

# -----------------------
# 新しいブランチ作成
# -----------------------
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NEW_BRANCH="${BRANCH_PREFIX}-${TIMESTAMP}"

log "Creating new branch: $NEW_BRANCH"
git checkout -b "$NEW_BRANCH"

log "✓ Branch created"

# -----------------------
# Planファイル配置
# -----------------------
log "Setting up plan file..."

mkdir -p "$FRONT_DIR/docs"
echo "$PLAN_TEXT" > "$FRONT_DIR/docs/plan.md"

log "✓ Plan file ready"

# -----------------------
# OpenCode Auth復元（セッション固有）
# -----------------------
log "Restoring OpenCode auth..."
mkdir -p ~/.local/share/opencode
echo "$OPENCODE_AUTH_JSON_B64" | base64 -d > ~/.local/share/opencode/auth.json
chmod 600 ~/.local/share/opencode/auth.json

# -----------------------
# OpenCode実行
# -----------------------
log "Running OpenCode with quality gates..."

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
   - If there are type errors, analyze them and fix the root cause
   - Do not use 'any' or '@ts-ignore' to bypass errors
   - Ensure all imports are correct and types are properly defined

3. Lint check (MUST pass with 0 errors):
   \`\`\`bash
   npm run lint
   \`\`\`
   - Fix all linting errors
   - Follow existing code patterns and conventions

If ANY check fails:
- Read the error messages carefully
- Fix the root cause (not just symptoms)
- Re-run ALL checks from step 1
- Repeat until ALL checks pass

Only after ALL checks pass with 0 errors, provide a summary of:
- What was implemented
- What issues were found and how you fixed them
- Confirmation that all quality gates passed"

popd >/dev/null

# -----------------------
# コミット
# -----------------------
log "Committing changes..."

git add -A

if git diff --cached --quiet; then
  die "No changes detected. Nothing to commit."
fi

git commit -m "feat: implement task from plan

Implemented by OpenCode with quality gates passed."

log "✓ Changes committed"

# -----------------------
# PR生成（簡易版）
# -----------------------
log "Generating PR content..."

# Planファイルから要約取得
PLAN_SUMMARY=$(head -n 3 "$FRONT_DIR/docs/plan.md")

PR_TITLE="feat: ${PLAN_SUMMARY:0:50}"
PR_BODY="## 概要

${PLAN_TEXT}

## 実装内容

- OpenCodeによる自動実装
- 品質チェック済み (TypeScript/Lint)

## 変更ファイル
\`\`\`bash
$(git diff --name-status "$BASE_BRANCH"..HEAD)
\`\`\`

## 確認方法
\`\`\`bash
npm ci
npm run build
\`\`\`"

# -----------------------
# Push & PR作成
# -----------------------
log "Pushing branch..."

git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git"
git push origin "$NEW_BRANCH"

log "✓ Branch pushed"

log "Creating PR..."

echo "$GITHUB_TOKEN" | gh auth login --with-token
gh repo set-default "$REPO_SLUG"

PR_URL=$(gh pr create \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --base "$BASE_BRANCH" \
  --head "$NEW_BRANCH")

log "✅ PR created successfully!"
log "   PR URL: $PR_URL"
log "   Branch: $NEW_BRANCH -> $BASE_BRANCH"

echo "$PR_URL"
```

---

## 📊 パフォーマンス比較

### ❌ スナップショットなし（現在）

```
1. Sandbox起動: 5秒
2. リポジトリクローン: 19秒
3. ツールインストール: 3秒
4. 依存関係インストール: 18秒
5. ブランチ作成: 1秒
6. Plan配置: 1秒
---
準備完了まで: 47秒

7. OpenCode実行: 382秒
8. コミット: 1秒
9. PR生成: 49秒
10. PR作成: 3秒
---
総合計: 482秒 (約8分)
```

### ✅ スナップショット使用

```
1. スナップショット復元: 3秒 ⚡
2. stagingアップデート: 2秒
3. ブランチ作成: 1秒
4. Plan配置: 1秒
---
準備完了まで: 7秒 (40秒短縮！)

5. OpenCode実行: 382秒
6. コミット: 1秒
7. PR生成（簡易版）: 5秒 ⚡
8. PR作成: 3秒
---
総合計: 398秒 (約6.6分)

短縮効果: 84秒 (17.4%)
```

---

## 🔄 ワークフロー図

### スナップショット作成（週1回）

```
┌─────────────────────────────────────────┐
│ 1. 新しいSandbox起動                      │
│ 2. staging ブランチをクローン               │
│ 3. ツールインストール                       │
│ 4. 依存関係インストール                     │
│ 5. Git設定                              │
│ 6. スナップショット作成                     │
│    → SNAPSHOT_ID取得                    │
└─────────────────────────────────────────┘
         │
         │ 週次実行
         ↓
    【保存】SNAPSHOT_ID
```

### 日次PR作成（1日10-20回）

```
┌─────────────────────────────────────────┐
│ Session 1: タスクA                       │
├─────────────────────────────────────────┤
│ 1. スナップショット復元 (3秒)              │
│ 2. ブランチ作成: ai/task-20260204-0900  │
│ 3. Plan配置: タスクA内容                 │
│ 4. OpenCode実行 (6分)                   │
│ 5. PR作成 → #884                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Session 2: タスクB                       │
├─────────────────────────────────────────┤
│ 1. スナップショット復元 (3秒)              │
│ 2. ブランチ作成: ai/task-20260204-1030  │
│ 3. Plan配置: タスクB内容                 │
│ 4. OpenCode実行 (6分)                   │
│ 5. PR作成 → #885                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Session 3: タスクC                       │
├─────────────────────────────────────────┤
│ 1. スナップショット復元 (3秒)              │
│ 2. ブランチ作成: ai/task-20260204-1400  │
│ 3. Plan配置: タスクC内容                 │
│ 4. OpenCode実行 (6分)                   │
│ 5. PR作成 → #886                        │
└─────────────────────────────────────────┘

... 1日に10-20セッション
```

---

## 📈 1日あたりのコスト・ベネフィット

### 実行回数: 15回/日（想定）

```
現在の所要時間:
15回 × 482秒 = 7,230秒 (約2時間)

スナップショット使用後:
15回 × 398秒 = 5,970秒 (約1.7時間)

1日あたりの短縮:
1,260秒 = 21分

1ヶ月あたりの短縮:
約7時間

管理コスト:
週15分（スナップショット更新）
```

**ROI: 非常に高い！** 🎉

---

## 🔧 スナップショット更新戦略

### 1. 定期更新（推奨）

```bash
# cron: 毎週日曜日 2:00
0 2 * * 0 /path/to/create-base-snapshot.sh

手順:
1. 最新のstagingブランチで環境構築
2. 新しいスナップショット作成
3. SNAPSHOT_IDを環境変数に設定
4. 古いスナップショット削除
```

### 2. 依存関係変更時

```bash
# package-lock.json更新時に自動実行
on:
  push:
    paths:
      - 'frontend/package-lock.json'
    branches:
      - staging

jobs:
  update-snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Create new snapshot
        run: ./create-base-snapshot.sh
```

### 3. ツール更新時

```bash
# OpenCodeやGitHub CLIのバージョンアップ時
# 手動でスナップショット再作成
./create-base-snapshot.sh
```

---

## 💡 ベストプラクティス

### ✅ DO

1. **ブランチ未作成の状態でスナップショット化**
   ```
   ✅ staging直後
   ❌ 作業ブランチ作成後
   ```

2. **stagingの最新状態を取り込む（オプション）**
   ```bash
   # スナップショット復元後
   git fetch origin staging
   git reset --hard origin/staging
   ```

3. **スナップショットIDを環境変数で管理**
   ```bash
   # .env or GitHub Secrets
   SNAPSHOT_ID=snap_xxxxxxxx
   ```

4. **PR生成を簡略化**
   ```bash
   # AI生成: 49秒
   # テンプレート: 1秒
   → 48秒短縮
   ```

### ❌ DON'T

1. **作業ブランチをスナップショット化しない**
   ```
   各セッションで異なるブランチが必要
   → スナップショットには含めない
   ```

2. **古いスナップショットを放置しない**
   ```
   定期的にクリーンアップ
   ```

3. **認証情報を含めない**
   ```
   GITHUB_TOKEN, OPENCODE_AUTH
   → セッションごとに動的に設定
   ```

---

## 🎯 実装チェックリスト

### Phase 1: スナップショット作成

- [ ] `create-base-snapshot.sh` 作成
- [ ] 手動実行してスナップショットID取得
- [ ] SNAPSHOT_IDを環境変数に設定

### Phase 2: ワークフロー更新

- [ ] `run-opencode-from-snapshot.sh` 作成
- [ ] 既存スクリプトをスナップショット版に置き換え
- [ ] テスト実行（1-2回）

### Phase 3: 自動更新設定

- [ ] 週次cron設定
- [ ] package-lock.json更新時のトリガー設定
- [ ] 古いスナップショット削除スクリプト

### Phase 4: 最適化

- [ ] PR生成のテンプレート化（49秒→1秒）
- [ ] エラーハンドリング強化
- [ ] ログ・モニタリング設定

---

## 🎉 期待される効果

```
現在（スナップショットなし）:
- 1セッション: 482秒 (8分)
- 15セッション/日: 120分

改善後（スナップショットあり）:
- 1セッション: 398秒 (6.6分)
- 15セッション/日: 99分

1日の短縮: 21分
1ヶ月の短縮: 約7時間
年間の短縮: 約84時間（3.5日分！）
```

**あなたのユースケースでは、スナップショットが最大限の効果を発揮します！** 🚀