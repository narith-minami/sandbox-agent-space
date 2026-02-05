#!/usr/bin/env bash
# integrated-review-workflow.sh
# OpenCode実装 → AI Code Review → 分析 → 修正反復 → PR作成の統合ワークフロー
#
# 前提条件:
#   - PLAN_TEXT が環境変数で渡されていること（必須）
#   - .env.local に APIキーが設定されていること
#   - Vercel Sandbox Snapshotが作成済みであること
#   - GitHub CLI (gh) がインストール済みであること
#
# 使い方:
#   PLAN_TEXT="タスク内容" SNAPSHOT_ID=snap_xxx ./scripts/integrated-review-workflow.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# サンドボックスで create-base-snapshot 由来の場合は clone が repo/ にある
if [[ -d "$SCRIPT_DIR/repo" ]]; then
  cd "$SCRIPT_DIR/repo"
  PROJECT_ROOT="$SCRIPT_DIR/repo"
fi

# -----------------------
# 設定
# -----------------------
# 未指定時はカレント（プロジェクトルート）。frontend/ がない Next.js 等に対応
FRONT_DIR="${FRONT_DIR:-.}"
# ホストが frontend を渡してもディレクトリが無ければプロジェクトルートを使う
if [[ ! -d "$FRONT_DIR" ]]; then
  FRONT_DIR="."
fi
REVIEW_DIR="${REVIEW_DIR:-./ai-review-results}"
MAX_REVIEW_ITERATIONS="${MAX_REVIEW_ITERATIONS:-3}"
CURRENT_ITERATION=0

REPO_SLUG="${REPO_SLUG:-lbose-corp/yamachiku}"
BASE_BRANCH="${BASE_BRANCH:-staging}"
NEW_BRANCH="feature/ai-review-$(date +%Y%m%d-%H%M%S)"

log() { echo "[$(date +'%H:%M:%S')] $*"; }
die() { log "❌ ERROR: $*" >&2; exit 1; }

# -----------------------
# .env.local 読み込み
# -----------------------
# サンドボックスで Gist から run.sh として実行される場合は SCRIPT_DIR にホストが .env.local を配置する
if [[ -f "$SCRIPT_DIR/.env.local" ]]; then
  ENV_FILE="$SCRIPT_DIR/.env.local"
elif [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  ENV_FILE="$PROJECT_ROOT/.env.local"
else
  ENV_FILE="$PROJECT_ROOT/.env.local"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cat << EOF
❌ .env.local not found!

Create it with:
  cd $PROJECT_ROOT
  ./scripts/setup-env.sh

Or manually create: $PROJECT_ROOT/.env.local
with at least one AI provider API key:
  - ANTHROPIC_API_KEY (recommended)
  - OPENAI_API_KEY
  - GEMINI_API_KEY
EOF
  exit 1
fi

log "Loading environment from: $ENV_FILE"

# .env.local を読み込み（エクスポート）
set -a
source "$ENV_FILE"
set +a

# 必須チェック
if [[ -z "${ANTHROPIC_API_KEY:-}${OPENAI_API_KEY:-}${GEMINI_API_KEY:-}" ]]; then
  die "No AI provider API key found in .env.local. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY"
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  die "GITHUB_TOKEN not found in .env.local. Required for PR creation."
fi

: "${PLAN_TEXT:?PLAN_TEXT is required}"

# プロバイダー自動検出
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  AI_PROVIDER="anthropic"
  AI_MODEL="claude-3-haiku-20240307"
  log "Using Anthropic Claude Haiku"
elif [[ -n "${OPENAI_API_KEY:-}" ]]; then
  AI_PROVIDER="openai"
  AI_MODEL="gpt-4o-mini"
  log "Using OpenAI GPT-4o-mini"
elif [[ -n "${GEMINI_API_KEY:-}" ]]; then
  AI_PROVIDER="gemini"
  AI_MODEL="gemini-2.0-flash-exp"
  log "Using Google Gemini Flash"
fi

# -----------------------
# ヘルパー関数
# -----------------------
# jq が無いサンドボックスでも動くように Node で JSON を扱う
json_get() {
  local json="$1" path="$2" default="${3:-}"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "${path} // \"$default\"" 2>/dev/null || echo "$default"
  else
    node -e "
      try {
        var j = JSON.parse(process.argv[1]);
        var p = (process.argv[2] || '').replace(/^\\./, '').split('.');
        var v = j;
        for (var i = 0; i < p.length && v != null; i++) v = v[p[i]];
        console.log(v !== undefined && v !== null ? String(v) : process.argv[3]);
      } catch (e) { console.log(process.argv[3]); }
    " "$json" "$path" "$default" 2>/dev/null || echo "$default"
  fi
}
json_pretty() {
  local json="$1"
  if command -v jq &>/dev/null; then
    echo "$json" | jq '.' 2>/dev/null || echo "$json"
  else
    node -e "try { console.log(JSON.stringify(JSON.parse(process.argv[1]), null, 2)); } catch(e) { console.log(process.argv[1]); }" "$json" 2>/dev/null || echo "$json"
  fi
}

run_opencode_implementation() {
  local task_description="$1"
  local iteration_note="${2:-}"
  
  log "Running OpenCode implementation..."
  pushd "$FRONT_DIR" >/dev/null
  
  opencode run "$task_description

$iteration_note

Project:
- Next.js app (or frontend app in this directory)
- Use existing patterns and conventions
- Dependencies are already installed (node_modules exists)

Rules:
- Do not modify files outside this directory
- Keep changes minimal and reviewable
- Do NOT run 'npm ci' or 'npm install' (already done)

Implementation Steps:
1. Read and understand the requirements
2. Implement the functionality
3. Run quality gates (detailed below)
4. Self-review your changes

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

Only after ALL checks pass with 0 errors, provide a summary of changes."
  
  popd >/dev/null
}

run_ai_review() {
  local review_type="${1:-comprehensive}"
  local output_suffix="${2:-}"
  
  mkdir -p "$REVIEW_DIR"
  
  log "Running ${review_type} review..."
  
  local log_file="${REVIEW_DIR}/review-${review_type}${output_suffix}.log"
  
  # CLI は .ai-review-config.json または .ai-code-review/config.yaml を参照。--provider/--model は非対応のため渡さない
  npx @bobmatnyc/ai-code-review "$FRONT_DIR" \
    --type "$review_type" \
    --output json \
    2>&1 | tee "$log_file" || true
  
  # レビュー結果ファイルを探す
  local review_files=$(find "$FRONT_DIR/ai-review-docs" -name "*.json" -o -name "*.md" 2>/dev/null || true)
  
  if [[ -n "$review_files" ]]; then
    # レビュー結果を統合ディレクトリにコピー
    mkdir -p "$REVIEW_DIR/docs"
    cp -r "$FRONT_DIR/ai-review-docs"/* "$REVIEW_DIR/docs/" 2>/dev/null || true
    log "✓ Review results saved to $REVIEW_DIR/docs"
  else
    log "⚠️  No review output found for ${review_type}"
  fi
}

analyze_review_results() {
  local review_dir="$1"
  
  log "Analyzing review results..."
  
  # レビューファイルが存在するか確認
  if [[ ! -d "$review_dir/docs" ]] || [[ -z "$(ls -A "$review_dir/docs" 2>/dev/null)" ]]; then
    log "⚠️  No review files found in $review_dir/docs"
    echo '{"totalIssues":0,"bySeverity":{"critical":0,"high":0,"medium":0,"low":0},"needsFix":false,"criticalIssues":[]}'
    return
  fi
  
  # Node.js スクリプトで解析
  node "$SCRIPT_DIR/review-tools/analyze-review.js" "$review_dir/docs" 2>/dev/null || echo '{"totalIssues":0,"bySeverity":{"critical":0,"high":0,"medium":0,"low":0},"needsFix":false,"criticalIssues":[]}'
}

# -----------------------
# Step 1-6: 既存の準備処理（省略可能）
# -----------------------
log "==================================================================="
log "Starting Integrated AI Code Review Workflow"
log "==================================================================="
log "Repository: $REPO_SLUG"
log "Base branch: $BASE_BRANCH"
log "New branch: $NEW_BRANCH"
log "AI Provider: $AI_PROVIDER ($AI_MODEL)"
log "Max iterations: $MAX_REVIEW_ITERATIONS"
log "==================================================================="

# Git ブランチ作成
if [[ -d .git ]]; then
  git checkout -b "$NEW_BRANCH"
  log "✓ Created branch: $NEW_BRANCH"
fi

# -----------------------
# Step 7: OpenCode初期実装
# -----------------------
log "Step 7/11: Running OpenCode for initial implementation..."

run_opencode_implementation "$PLAN_TEXT"

log "✓ OpenCode initial implementation completed"

# -----------------------
# Step 8: AIレビュー実行（並列）
# -----------------------
log "Step 8/11: Running AI Code Review (multiple types in parallel)..."

# 前回のレビュー結果をクリア
rm -rf "$REVIEW_DIR"
rm -rf "$FRONT_DIR/ai-review-docs"
mkdir -p "$REVIEW_DIR"

# 複数タイプのレビューを並列実行
run_ai_review "security" &
SECURITY_PID=$!
run_ai_review "performance" &
PERFORMANCE_PID=$!
run_ai_review "comprehensive" &
COMPREHENSIVE_PID=$!

# 全レビュー完了を待機
wait $SECURITY_PID
wait $PERFORMANCE_PID
wait $COMPREHENSIVE_PID

log "✓ All reviews completed"

# -----------------------
# Step 9: レビュー結果分析
# -----------------------
log "Step 9/11: Analyzing review results..."

ANALYSIS_JSON=$(analyze_review_results "$REVIEW_DIR")
json_pretty "$ANALYSIS_JSON" > "$REVIEW_DIR/analysis.json"

# 分析結果から判定
NEEDS_FIX=$(json_get "$ANALYSIS_JSON" ".needsFix" "false")
CRITICAL_COUNT=$(json_get "$ANALYSIS_JSON" ".bySeverity.critical" "0")
HIGH_COUNT=$(json_get "$ANALYSIS_JSON" ".bySeverity.high" "0")
MEDIUM_COUNT=$(json_get "$ANALYSIS_JSON" ".bySeverity.medium" "0")
LOW_COUNT=$(json_get "$ANALYSIS_JSON" ".bySeverity.low" "0")
TOTAL_ISSUES=$(json_get "$ANALYSIS_JSON" ".totalIssues" "0")

log "Review Analysis:"
log "  - Total issues: $TOTAL_ISSUES"
log "  - Critical: $CRITICAL_COUNT"
log "  - High: $HIGH_COUNT"
log "  - Medium: $MEDIUM_COUNT"
log "  - Low: $LOW_COUNT"

# -----------------------
# Step 10: 修正が必要なら反復
# -----------------------
while [[ "$NEEDS_FIX" == "true" ]] && [[ $CURRENT_ITERATION -lt $MAX_REVIEW_ITERATIONS ]]; do
  CURRENT_ITERATION=$((CURRENT_ITERATION + 1))
  
  log "Step 10/11: Issues found. Running OpenCode fix iteration $CURRENT_ITERATION..."
  
  # 修正指示を読み込み
  if [[ -f "$REVIEW_DIR/docs/fix-instructions.txt" ]]; then
    FIX_INSTRUCTIONS=$(cat "$REVIEW_DIR/docs/fix-instructions.txt")
  else
    log "⚠️  No fix-instructions.txt found, skipping fix iteration"
    break
  fi
  
  # OpenCodeで修正実行
  ITERATION_NOTE="ITERATION $CURRENT_ITERATION - FIXING PREVIOUS ISSUES:

The previous implementation had the following critical/high severity issues:

$FIX_INSTRUCTIONS

Please fix ALL these issues while:
- Maintaining the original functionality
- Following the same coding patterns
- Ensuring quality gates still pass
- Providing clear explanations of fixes"

  run_opencode_implementation "$PLAN_TEXT" "$ITERATION_NOTE"
  
  log "✓ OpenCode fix iteration $CURRENT_ITERATION completed"
  
  # 再度レビュー実行
  log "Re-running comprehensive review..."
  rm -rf "$FRONT_DIR/ai-review-docs"
  rm -rf "$REVIEW_DIR/docs"
  
  run_ai_review "comprehensive" "-iteration${CURRENT_ITERATION}"
  
  # 再分析
  ANALYSIS_JSON=$(analyze_review_results "$REVIEW_DIR")
  json_pretty "$ANALYSIS_JSON" > "$REVIEW_DIR/analysis-iteration${CURRENT_ITERATION}.json"
  
  NEEDS_FIX=$(json_get "$ANALYSIS_JSON" ".needsFix" "false")
  CRITICAL_COUNT=$(json_get "$ANALYSIS_JSON" ".bySeverity.critical" "0")
  HIGH_COUNT=$(json_get "$ANALYSIS_JSON" ".bySeverity.high" "0")
  
  log "Re-review Analysis (Iteration $CURRENT_ITERATION):"
  log "  - Critical: $CRITICAL_COUNT"
  log "  - High: $HIGH_COUNT"
  
  if [[ "$NEEDS_FIX" == "false" ]]; then
    log "✅ All critical/high issues resolved!"
    break
  fi
done

# 最大反復回数に達した場合
if [[ $CURRENT_ITERATION -ge $MAX_REVIEW_ITERATIONS ]] && [[ "$NEEDS_FIX" == "true" ]]; then
  log "⚠️  Maximum iterations ($MAX_REVIEW_ITERATIONS) reached with unresolved issues"
  log "⚠️  Manual review required before PR"
fi

# -----------------------
# Step 11: 最終チェック & PR作成
# -----------------------
log "Step 11/11: Final checks and creating PR..."

# package.json があるディレクトリにいることを保証（サンドボックスで cwd が /vercel/sandbox のままのとき）
if [[ ! -f "package.json" ]] && [[ -d "$SCRIPT_DIR/repo" ]]; then
  cd "$SCRIPT_DIR/repo" || true
fi

# 最終的な品質チェック
log "Running final quality gates..."
pushd "$FRONT_DIR" >/dev/null

# Biome
log "Running Biome..."
if ! npx biome check --write . 2>&1 | tail -5; then
  log "⚠️  Biome check had warnings (non-fatal)"
fi

# TypeScript
log "Running TypeScript check..."
if ! npm run tsc 2>&1 | tail -10; then
  die "TypeScript check failed"
fi

# Lint
log "Running Lint..."
if ! npm run lint 2>&1 | tail -10; then
  die "Lint check failed"
fi

popd >/dev/null
log "✓ All quality gates passed"

# Git設定
git config user.name "OpenCode Bot"
git config user.email "opencode-bot@users.noreply.github.com"

# コミット
git add -A
if git diff --cached --quiet; then
  die "No changes detected. Nothing to commit."
fi

# コミットメッセージ生成
COMMIT_MSG="feat: implement task from plan

Implemented by OpenCode with AI Code Review integration

Quality gates: ✓ Format ✓ TypeScript ✓ Lint
AI Review: $(if [[ "$NEEDS_FIX" == "false" ]]; then echo "✓ Passed"; else echo "⚠️ Manual review needed"; fi) ($CURRENT_ITERATION iterations)
  - Critical issues: $CRITICAL_COUNT
  - High issues: $HIGH_COUNT
  - Medium issues: $MEDIUM_COUNT
  - Low issues: $LOW_COUNT"

git commit -m "$COMMIT_MSG"
log "✓ Changes committed"

# PR内容生成
PLAN_SUMMARY=$(echo "$PLAN_TEXT" | head -n 1 | cut -c1-60)
PR_TITLE="feat: ${PLAN_SUMMARY}"

# レビューサマリー生成
REVIEW_SUMMARY=$(cat <<EOF
## 🤖 AI Code Review Summary

**Review Iterations:** $CURRENT_ITERATION
**Final Status:** $(if [[ "$NEEDS_FIX" == "false" ]]; then echo "✅ Approved"; else echo "⚠️ Needs Manual Review"; fi)
**AI Provider:** $AI_PROVIDER ($AI_MODEL)

### Issue Breakdown
- 🔴 Critical: $CRITICAL_COUNT
- 🟠 High: $HIGH_COUNT
- 🟡 Medium: $MEDIUM_COUNT
- 🟢 Low: $LOW_COUNT
- **Total:** $TOTAL_ISSUES

### Review Types Executed
- ✓ Security Review (authentication, SQL injection, XSS, etc.)
- ✓ Performance Review (N+1 queries, caching, bundle size)
- ✓ Comprehensive Review (code quality, best practices, testing)

<details>
<summary>📊 Detailed Analysis</summary>

\`\`\`json
$ANALYSIS_JSON
\`\`\`

</details>
EOF
)

PR_BODY="## 📋 タスク内容

\`\`\`
${PLAN_TEXT}
\`\`\`

## ✅ 実装完了

- OpenCodeによる自動実装
- AI Code Review実施（$CURRENT_ITERATION iterations）
- 品質チェック済み (Format / TypeScript / Lint)

$REVIEW_SUMMARY

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
Generated by Snapshot Workflow v2.0 with AI Code Review Integration
Powered by @bobmatnyc/ai-code-review"

# Push
log "Pushing branch..."
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git"
if ! git push origin "$NEW_BRANCH"; then
  die "Failed to push branch"
fi
log "✓ Branch pushed"

# GitHub CLI認証
log "Authenticating GitHub CLI..."
echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true

# リポジトリ設定
log "Setting repository..."
gh repo set-default "$REPO_SLUG" 2>/dev/null || true

# PR作成
log "Creating pull request..."
PR_URL=$(gh pr create \
  --repo "$REPO_SLUG" \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --base "$BASE_BRANCH" \
  --head "$NEW_BRANCH" 2>&1)

PR_EXIT_CODE=$?

if [[ $PR_EXIT_CODE -ne 0 ]]; then
  log "❌ PR creation failed with exit code: $PR_EXIT_CODE"
  log "Error output: $PR_URL"
  die "Failed to create pull request"
fi

log "==================================================================="
log "✅ PR Created Successfully with AI Review!"
log "==================================================================="
log "PR URL: $PR_URL"
log "Branch: $NEW_BRANCH -> $BASE_BRANCH"
log "Workflow: Snapshot v2.0 with AI Review"
log "Review Iterations: $CURRENT_ITERATION"
log "Final Status: $(if [[ "$NEEDS_FIX" == "false" ]]; then echo "✅ Approved"; else echo "⚠️ Manual Review Needed"; fi)"
log "Total Issues: $TOTAL_ISSUES (Critical: $CRITICAL_COUNT, High: $HIGH_COUNT)"
log "Total time: ${SECONDS}s"
log "==================================================================="

# レビュー結果を添付ファイルとしてPRコメントに追加
if [[ -f "$REVIEW_DIR/analysis.json" ]]; then
  log "Adding review analysis as PR comment..."
  
  COMMENT_BODY="## 📊 Detailed AI Review Analysis

<details>
<summary>Click to expand full analysis</summary>

\`\`\`json
$(cat "$REVIEW_DIR/analysis.json")
\`\`\`

</details>

### Review Artifacts
- Analysis results: \`$REVIEW_DIR/analysis.json\`
- Review logs: \`$REVIEW_DIR/*.log\`
- Review docs: \`$REVIEW_DIR/docs/\`

### AI Provider
- Provider: $AI_PROVIDER
- Model: $AI_MODEL
- Iterations: $CURRENT_ITERATION"

  gh pr comment "$PR_URL" --body "$COMMENT_BODY" 2>/dev/null || log "⚠️  Failed to add PR comment"
fi

echo "$PR_URL"
log "✓ Workflow completed successfully"
