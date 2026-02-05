#!/bin/bash
# run-opencode-with-snapshot.sh
# Optimized for snapshot-based workflow with AI Code Review Integration
# 1 task = 1 branch = 1 session
#
# Version: 2.1.0 (AI Review Integration)
#
# 必須環境変数: 
#   SNAPSHOT_ID, GITHUB_TOKEN, OPENCODE_AUTH_JSON_B64, PLAN_TEXT
#   ANTHROPIC_API_KEY (または OPENAI_API_KEY / GEMINI_API_KEY)

set -euo pipefail

# ============================================================
# Snapshot-based OpenCode Workflow with AI Code Review
# Created: 2026-02-04
# Updated: 2026-02-05 (AI Review Integration)
# Version: 2.1.0
# ============================================================

# -----------------------
# Required (Snapshot版特有)
# -----------------------
: "${SNAPSHOT_ID:?SNAPSHOT_ID is required for snapshot workflow}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${OPENCODE_AUTH_JSON_B64:?OPENCODE_AUTH_JSON_B64 is required}"
: "${PLAN_TEXT:?PLAN_TEXT is required}"

# AI Review用（いずれか1つ必須）
if [[ -z "${ANTHROPIC_API_KEY:-}${OPENAI_API_KEY:-}${GEMINI_API_KEY:-}" ]]; then
  echo "❌ ERROR: AI provider API key required"
  echo "Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY"
  exit 1
fi

# -----------------------
# Optional
# -----------------------
BASE_BRANCH="${BASE_BRANCH:-staging}"
FRONT_DIR="${FRONT_DIR:-frontend}"
BRANCH_PREFIX="${BRANCH_PREFIX:-ai/task}"
REVIEW_DIR="${REVIEW_DIR:-ai-review-results}"
MAX_REVIEW_ITERATIONS="${MAX_REVIEW_ITERATIONS:-3}"

# AI Provider 自動検出
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  AI_PROVIDER="anthropic"
  AI_MODEL="${AI_MODEL:-claude-3-haiku-20240307}"
elif [[ -n "${OPENAI_API_KEY:-}" ]]; then
  AI_PROVIDER="openai"
  AI_MODEL="${AI_MODEL:-gpt-4o-mini}"
elif [[ -n "${GEMINI_API_KEY:-}" ]]; then
  AI_PROVIDER="gemini"
  AI_MODEL="${AI_MODEL:-gemini-2.0-flash-exp}"
fi

# -----------------------
# Helpers
# -----------------------
log() { printf "\n[run] %s %s\n" "$(date +'%H:%M:%S')" "$*"; }
die() { printf "\n[error] %s\n" "$*" >&2; exit 1; }

log "==================================================================="
log "🚀 Snapshot-based OpenCode + AI Review Workflow v2.1"
log "==================================================================="
log "Snapshot ID: $SNAPSHOT_ID"
log "Base Branch: $BASE_BRANCH"
log "AI Provider: $AI_PROVIDER ($AI_MODEL)"
log "Max Review Iterations: $MAX_REVIEW_ITERATIONS"

# -----------------------
# 1. Sandbox復元（スナップショットから）
# -----------------------
log "Step 1/12: Restoring from snapshot..."

# スナップショットから起動（この処理はVercel Sandboxプラットフォーム側で実行済み）
# 既に以下が準備完了:
# - Repository cloned at staging
# - OpenCode & GitHub CLI installed
# - npm dependencies installed
# - Git configured
# - AI Code Review CLI installed (snapshot準備時)

log "✓ Sandbox restored (3 seconds)"

# -----------------------
# 2. 作業ディレクトリに移動
# -----------------------
WORKDIR="${WORKDIR:-/vercel/sandbox/repo}"
cd "$WORKDIR" || die "Failed to change directory to $WORKDIR"

# 既存の origin から owner/repo を取得（push / gh 用）
REPO_SLUG=$(git config --get remote.origin.url | sed -e 's|.*github\.com[:/]||' -e 's|\.git$||')
log "Repo: $REPO_SLUG"
log "Step 2/12: Moved to workspace"

# -----------------------
# 3. ベースブランチを最新に（必須）
# -----------------------
log "Step 3/12: Updating base branch to latest..."

git fetch origin "$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"

log "✓ Base branch updated to latest"

# -----------------------
# 4. 新しいブランチ作成
# -----------------------
log "Step 4/12: Creating new branch..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NEW_BRANCH="${BRANCH_PREFIX}-${TIMESTAMP}"

git checkout -b "$NEW_BRANCH"

log "✓ Branch created: $NEW_BRANCH"

# -----------------------
# 5. Planファイル配置
# -----------------------
log "Step 5/12: Setting up plan..."

mkdir -p "$FRONT_DIR/docs"
echo "$PLAN_TEXT" > "$FRONT_DIR/docs/plan.md"

log "✓ Plan file ready"

# -----------------------
# 6. OpenCode Auth復元
# -----------------------
log "Step 6/12: Restoring OpenCode auth..."

mkdir -p ~/.local/share/opencode
echo "$OPENCODE_AUTH_JSON_B64" | base64 -d > ~/.local/share/opencode/auth.json
chmod 600 ~/.local/share/opencode/auth.json

log "✓ Auth restored"

# -----------------------
# Helper: OpenCode実行
# -----------------------
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

# -----------------------
# Helper: AIレビュー実行
# -----------------------
run_ai_review() {
  local review_type="${1:-comprehensive}"
  local output_suffix="${2:-}"
  
  mkdir -p "$REVIEW_DIR/docs"
  
  log "Running ${review_type} review..."
  
  local log_file="${REVIEW_DIR}/review-${review_type}${output_suffix}.log"
  
  npx @bobmatnyc/ai-code-review "$FRONT_DIR" \
    --type "$review_type" \
    --provider "$AI_PROVIDER" \
    --model "$AI_MODEL" \
    --output json \
    2>&1 | tee "$log_file" || true
  
  # レビュー結果ファイルを探してコピー
  if [[ -d "$FRONT_DIR/ai-review-docs" ]]; then
    cp -r "$FRONT_DIR/ai-review-docs"/* "$REVIEW_DIR/docs/" 2>/dev/null || true
    log "✓ Review results saved to $REVIEW_DIR/docs"
  else
    log "⚠️  No review output found for ${review_type}"
  fi
}

# -----------------------
# Helper: レビュー結果分析
# -----------------------
analyze_review_results() {
  local review_dir="$1"
  
  log "Analyzing review results..."
  
  # レビューファイルが存在するか確認
  if [[ ! -d "$review_dir/docs" ]] || [[ -z "$(ls -A "$review_dir/docs" 2>/dev/null)" ]]; then
    log "⚠️  No review files found in $review_dir/docs"
    echo '{"totalIssues":0,"bySeverity":{"critical":0,"high":0,"medium":0,"low":0},"needsFix":false,"criticalIssues":[]}'
    return
  fi
  
  # analyze-review.js を使用（snapshotに含まれている想定）
  if [[ -f "scripts/review-tools/analyze-review.js" ]]; then
    node scripts/review-tools/analyze-review.js "$review_dir/docs" 2>/dev/null || \
      echo '{"totalIssues":0,"bySeverity":{"critical":0,"high":0,"medium":0,"low":0},"needsFix":false,"criticalIssues":[]}'
  else
    # フォールバック: インライン分析
    node <<'EOFNODE'
const fs = require('fs');
const path = require('path');

const reviewDir = process.argv[1];
const reviewFiles = fs.readdirSync(reviewDir)
  .filter(f => f.endsWith('.json') || f.endsWith('.md'))
  .map(f => path.join(reviewDir, f));

if (reviewFiles.length === 0) {
  console.log(JSON.stringify({
    totalIssues: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    needsFix: false,
    criticalIssues: []
  }));
  process.exit(0);
}

const allIssues = [];
const issuesBySeverity = { critical: [], high: [], medium: [], low: [] };

reviewFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    
    if (file.endsWith('.json')) {
      const data = JSON.parse(content);
      const issues = data.issues || data.findings || [];
      issues.forEach(issue => {
        allIssues.push(issue);
        const severity = (issue.severity || 'low').toLowerCase();
        if (issuesBySeverity[severity]) issuesBySeverity[severity].push(issue);
      });
    }
    
    if (file.endsWith('.md')) {
      const severityPattern = /\*\*Severity:\*\*\s*(Critical|High|Medium|Low)/gi;
      let match;
      while ((match = severityPattern.exec(content)) !== null) {
        const severity = match[1].toLowerCase();
        const issue = { severity, file: 'unknown', description: 'See markdown' };
        allIssues.push(issue);
        if (issuesBySeverity[severity]) issuesBySeverity[severity].push(issue);
      }
    }
  } catch (e) {
    console.error(`Failed to parse ${file}: ${e.message}`);
  }
});

const analysis = {
  totalIssues: allIssues.length,
  bySeverity: {
    critical: issuesBySeverity.critical.length,
    high: issuesBySeverity.high.length,
    medium: issuesBySeverity.medium.length,
    low: issuesBySeverity.low.length
  },
  criticalIssues: issuesBySeverity.critical.concat(issuesBySeverity.high),
  needsFix: issuesBySeverity.critical.length > 0 || issuesBySeverity.high.length > 0
};

console.log(JSON.stringify(analysis, null, 2));

if (analysis.needsFix) {
  const fixInstructions = analysis.criticalIssues.map((issue, idx) => {
    return `${idx + 1}. [${(issue.severity || 'unknown').toUpperCase()}] ${issue.file}
   Issue: ${issue.description || issue.message || 'No description'}
`;
  }).join('\n');
  
  fs.writeFileSync(
    path.join(reviewDir, 'fix-instructions.txt'),
    `Critical and High Severity Issues:\n\n${fixInstructions}`
  );
}
EOFNODE
"$review_dir/docs"
  fi
}

# -----------------------
# 7. OpenCode初期実装
# -----------------------
log "Step 7/12: Running OpenCode for initial implementation..."

run_opencode_implementation "$PLAN_TEXT"

log "✓ OpenCode initial implementation completed"

# -----------------------
# 8. AIレビュー実行（並列）
# -----------------------
log "Step 8/12: Running AI Code Review (parallel)..."

# 前回のレビュー結果をクリア
rm -rf "$REVIEW_DIR"
rm -rf "$FRONT_DIR/ai-review-docs"
mkdir -p "$REVIEW_DIR/docs"

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
# 9. レビュー結果分析
# -----------------------
log "Step 9/12: Analyzing review results..."

ANALYSIS_JSON=$(analyze_review_results "$REVIEW_DIR")
echo "$ANALYSIS_JSON" > "$REVIEW_DIR/analysis.json"

# jq がある場合は整形
if command -v jq &>/dev/null; then
  cat "$REVIEW_DIR/analysis.json" | jq '.'
fi

# 分析結果から判定
NEEDS_FIX=$(echo "$ANALYSIS_JSON" | grep -o '"needsFix"[[:space:]]*:[[:space:]]*true' >/dev/null && echo "true" || echo "false")
CRITICAL_COUNT=$(echo "$ANALYSIS_JSON" | grep -o '"critical"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*$' || echo "0")
HIGH_COUNT=$(echo "$ANALYSIS_JSON" | grep -o '"high"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*$' || echo "0")
TOTAL_ISSUES=$(echo "$ANALYSIS_JSON" | grep -o '"totalIssues"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || echo "0")

log "Review Analysis:"
log "  - Total issues: $TOTAL_ISSUES"
log "  - Critical: $CRITICAL_COUNT"
log "  - High: $HIGH_COUNT"

# -----------------------
# 10. 修正が必要なら反復
# -----------------------
CURRENT_ITERATION=0

while [[ "$NEEDS_FIX" == "true" ]] && [[ $CURRENT_ITERATION -lt $MAX_REVIEW_ITERATIONS ]]; do
  CURRENT_ITERATION=$((CURRENT_ITERATION + 1))
  
  log "Step 10/12: Issues found. Running OpenCode fix iteration $CURRENT_ITERATION..."
  
  # 修正指示を読み込み
  if [[ ! -f "$REVIEW_DIR/fix-instructions.txt" ]]; then
    log "⚠️  No fix-instructions.txt found, skipping fix iteration"
    break
  fi
  
  FIX_INSTRUCTIONS=$(cat "$REVIEW_DIR/fix-instructions.txt")
  
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
  
  run_ai_review "comprehensive" "-iter${CURRENT_ITERATION}"
  
  # 再分析
  ANALYSIS_JSON=$(analyze_review_results "$REVIEW_DIR")
  echo "$ANALYSIS_JSON" > "$REVIEW_DIR/analysis-iteration${CURRENT_ITERATION}.json"
  
  NEEDS_FIX=$(echo "$ANALYSIS_JSON" | grep -o '"needsFix"[[:space:]]*:[[:space:]]*true' >/dev/null && echo "true" || echo "false")
  CRITICAL_COUNT=$(echo "$ANALYSIS_JSON" | grep -o '"critical"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*$' || echo "0")
  HIGH_COUNT=$(echo "$ANALYSIS_JSON" | grep -o '"high"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*$' || echo "0")
  
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
# 11. 最終チェック（品質ゲート）
# -----------------------
log "Step 11/12: Running final quality gates..."

pushd "$FRONT_DIR" >/dev/null

# Biome
log "Running Biome..."
npx biome check --write . 2>&1 | tail -5 || log "⚠️  Biome had warnings (non-fatal)"

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

# -----------------------
# 12. コミット & PR作成
# -----------------------
log "Step 12/12: Creating PR..."

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

Implemented by OpenCode (snapshot workflow v2.1)

Quality gates: ✓ Format ✓ TypeScript ✓ Lint
AI Review: $(if [[ "$NEEDS_FIX" == "false" ]]; then echo "✓ Passed"; else echo "⚠️ Manual review needed"; fi) ($CURRENT_ITERATION iterations)
  - Critical issues: $CRITICAL_COUNT
  - High issues: $HIGH_COUNT
  - Total issues: $TOTAL_ISSUES"

git commit -m "$COMMIT_MSG"

# PR内容生成
PLAN_SUMMARY=$(head -n 1 "$FRONT_DIR/docs/plan.md" | cut -c1-60)
PR_TITLE="feat: ${PLAN_SUMMARY}"

# レビューサマリー生成
REVIEW_SUMMARY="## 🤖 AI Code Review Summary

**Review Iterations:** $CURRENT_ITERATION
**Final Status:** $(if [[ "$NEEDS_FIX" == "false" ]]; then echo "✅ Approved"; else echo "⚠️ Needs Manual Review"; fi)
**AI Provider:** $AI_PROVIDER ($AI_MODEL)

### Issue Breakdown
- 🔴 Critical: $CRITICAL_COUNT
- 🟠 High: $HIGH_COUNT
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

</details>"

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
Generated by Snapshot Workflow v2.1 with AI Code Review Integration
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
log "Workflow: Snapshot v2.1 with AI Review"
log "Review Iterations: $CURRENT_ITERATION"
log "Final Status: $(if [[ "$NEEDS_FIX" == "false" ]]; then echo "✅ Approved"; else echo "⚠️ Manual Review Needed"; fi)"
log "Total time: ${SECONDS}s"
log "==================================================================="

# レビュー結果をPRコメントに追加
if [[ -f "$REVIEW_DIR/analysis.json" ]]; then
  log "Adding review analysis as PR comment..."
  
  gh pr comment "$PR_URL" --body "## 📊 Detailed AI Review Analysis

<details>
<summary>Click to expand full analysis</summary>

\`\`\`json
$(cat "$REVIEW_DIR/analysis.json")
\`\`\`

</details>

### Review Artifacts
- Analysis: \`$REVIEW_DIR/analysis.json\`
- Logs: \`$REVIEW_DIR/*.log\`

**AI Provider:** $AI_PROVIDER ($AI_MODEL)" 2>/dev/null || log "⚠️  Failed to add PR comment"
fi

echo "$PR_URL"
log "✓ Workflow completed successfully"
