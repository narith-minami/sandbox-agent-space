#!/usr/bin/env bash
# create-base-snapshot.sh
# staging 直後の状態をスナップショット化（plan.md に基づく）
#
# 実行コンテキスト: このスクリプトは Vercel Sandbox 内で実行することを想定しています。
# - サンドボックス作成: ホスト側で Sandbox.create() 後に exec で本スクリプトを実行
# - スナップショット作成: ホスト側で sandbox.snapshot() を呼ぶか、
#   環境で vercel_snapshot_create が利用可能な場合はそれを使用
#
# 環境変数で上書き可能:
#   REPO_URL, BASE_BRANCH, SNAPSHOT_NAME, OPENCODE_VERSION, GH_CLI_VERSION
#   非公開リポジトリの場合: GITHUB_TOKEN を設定すると clone に使用する

set -euo pipefail

log() { printf "[%s] %s\n" "$(date +'%H:%M:%S')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

REPO_URL="${REPO_URL:-}"
BASE_BRANCH="${BASE_BRANCH:-main}"
SNAPSHOT_NAME="${SNAPSHOT_NAME:-sandbox-main-ready}"
OPENCODE_VERSION="${OPENCODE_VERSION:-1.1.53}"
GH_CLI_VERSION="${GH_CLI_VERSION:-2.65.0}"

log "Creating base snapshot for daily PR workflow..."

# -----------------------
# Sandbox 作成（ホスト側で未作成の場合は環境変数 SANDBOX_ID を利用）
# -----------------------
if [[ -n "${SANDBOX_ID:-}" && "${SANDBOX_ID}" != "unknown" ]]; then
  log "1. Using existing sandbox: $SANDBOX_ID"
else
  log "1. Creating sandbox..."
  if command -v vercel_sandbox_create &>/dev/null; then
    SANDBOX_ID=$(vercel_sandbox_create)
  else
    log "   (vercel_sandbox_create not found; assume running inside existing sandbox)"
    SANDBOX_ID="${VERCEL_SANDBOX_ID:-unknown}"
  fi
fi

# -----------------------
# 環境セットアップ
# -----------------------
log "2. Setting up base environment..."

# TTY がない環境で git が Username を聞かないようにする
export GIT_TERMINAL_PROMPT=0

# クローン用 URL（GITHUB_TOKEN があれば非公開リポ用に埋め込む）
CLONE_URL="$REPO_URL"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  # https://github.com/owner/repo -> https://x-access-token:TOKEN@github.com/owner/repo
  if [[ "$REPO_URL" =~ ^https://github\.com/(.+)$ ]]; then
    CLONE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${BASH_REMATCH[1]}"
  fi
fi

# リポジトリクローン（staging）
git clone "$CLONE_URL" repo
cd repo
git checkout "$BASE_BRANCH"

log "✓ Repository cloned at $BASE_BRANCH branch"

# -----------------------
# ツールインストール（並列）
# -----------------------
log "3. Installing tools in parallel..."

mkdir -p "$HOME/.local/bin"

(
  # OpenCode
  curl -fsSL "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
    -o /tmp/opencode.tar.gz
  tar -xzf /tmp/opencode.tar.gz -C /tmp
  mv /tmp/opencode "$HOME/.local/bin/opencode"
  chmod +x "$HOME/.local/bin/opencode"
) &

(
  # GitHub CLI
  curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_CLI_VERSION}/gh_${GH_CLI_VERSION}_linux_amd64.tar.gz" \
    -o /tmp/gh.tar.gz
  tar -xzf /tmp/gh.tar.gz -C /tmp --strip-components=1
  mv /tmp/bin/gh "$HOME/.local/bin/gh"
  chmod +x "$HOME/.local/bin/gh"
) &

wait

export PATH="$HOME/.local/bin:$PATH"
log "✓ Tools installed"

# -----------------------
# 依存関係インストール
# -----------------------
log "4. Installing dependencies..."

if [[ -d frontend ]]; then
  cd frontend
  npm ci --no-audit
  cd ..
else
  log "   (no frontend/ dir, skipping npm ci)"
fi

log "✓ Dependencies installed"

# -----------------------
# OpenCode 設定
# -----------------------
log "5. Configuring OpenCode..."

mkdir -p ~/.config/opencode
cat > ~/.config/opencode/opencode.json << "EOF"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openai/gpt-5.3-codex",
  "small_model": "openai/gpt-5.1-codex-mini"
}
EOF

log "✓ OpenCode configured"

# -----------------------
# 3. AI Code Review ツールのセットアップ
# -----------------------
log "6. Setting up AI Code Review tools..."

# グローバルに AI Code Review をインストール
log "Installing @bobmatnyc/ai-code-review..."
npm install -g @bobmatnyc/ai-code-review@latest 2>&1 | grep -E "(added|changed|removed)" || true

# インストール確認
if ! command -v ai-code-review &>/dev/null; then
  die "Failed to install ai-code-review"
fi

AI_REVIEW_VERSION=$(npm list -g @bobmatnyc/ai-code-review --depth=0 2>/dev/null | grep @bobmatnyc || echo "unknown")
log "✓ AI Code Review installed: $AI_REVIEW_VERSION"

# -----------------------
# 4. レビュー設定ファイル作成（Gemini 指定）
# -----------------------
log "7. Creating review configuration (.ai-review-config.json)..."

cat > .ai-review-config.json << 'EOF'
{
  "provider": "gemini",
  "model": "gemini-3-flash-preview",
  "chunkingStrategy": "semantic",
  "maxTokensPerChunk": 4000,
  "reviewTypes": {
    "security": {
      "enabled": true,
      "focus": [
        "authentication",
        "authorization",
        "input-validation",
        "secrets",
        "sql-injection",
        "xss",
        "csrf"
      ]
    },
    "performance": {
      "enabled": true,
      "focus": [
        "database-queries",
        "n-plus-1-problems",
        "caching",
        "bundle-size",
        "memory-leaks",
        "api-calls"
      ]
    },
    "comprehensive": {
      "enabled": true,
      "focus": [
        "code-quality",
        "best-practices",
        "maintainability",
        "testing",
        "error-handling",
        "documentation"
      ]
    }
  },
  "laravel": {
    "enabled": true,
    "checks": [
      "eloquent-n-plus-1",
      "mass-assignment",
      "validation-rules",
      "route-security"
    ]
  },
  "nextjs": {
    "enabled": true,
    "checks": [
      "server-components",
      "client-components",
      "api-routes",
      "image-optimization",
      "bundle-analysis"
    ]
  }
}
EOF

log "✓ Review configuration created (provider: gemini, model: gemini-3-flash-preview)"

# -----------------------
# 5. レビュー分析スクリプトのセットアップ
# -----------------------
log "8. Setting up review analysis scripts..."

mkdir -p scripts/review-tools

cat > scripts/review-tools/analyze-review.js << 'EOFJS'
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const reviewDir = process.argv[2] || './ai-review-results';

if (!fs.existsSync(reviewDir)) {
  console.error(`Review directory not found: ${reviewDir}`);
  process.exit(1);
}

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
const issuesByFile = new Map();
const issuesBySeverity = { critical: [], high: [], medium: [], low: [] };

reviewFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    
    if (file.endsWith('.json')) {
      const data = JSON.parse(content);
      const issues = data.issues || data.findings || [];
      issues.forEach(issue => processIssue(issue));
    }
    
    if (file.endsWith('.md')) {
      const severityPattern = /\*\*Severity:\*\*\s*(Critical|High|Medium|Low)/gi;
      let match;
      
      while ((match = severityPattern.exec(content)) !== null) {
        const severity = match[1].toLowerCase();
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + 500);
        const context = content.substring(contextStart, contextEnd);
        
        const fileMatch = context.match(/File:\s*`([^`]+)`/);
        const categoryMatch = context.match(/Category:\s*([^\n]+)/);
        const lineMatch = context.match(/Line:\s*(\d+)/);
        
        const issue = {
          severity,
          file: fileMatch ? fileMatch[1] : 'unknown',
          category: categoryMatch ? categoryMatch[1].trim() : 'general',
          line: lineMatch ? parseInt(lineMatch[1]) : null,
          description: context.substring(0, 200)
        };
        
        processIssue(issue);
      }
    }
  } catch (e) {
    console.error(`Failed to parse ${file}: ${e.message}`);
  }
});

function processIssue(issue) {
  allIssues.push(issue);
  
  const fileName = issue.file || 'unknown';
  if (!issuesByFile.has(fileName)) {
    issuesByFile.set(fileName, []);
  }
  issuesByFile.get(fileName).push(issue);
  
  const severity = (issue.severity || 'low').toLowerCase();
  if (issuesBySeverity[severity]) {
    issuesBySeverity[severity].push(issue);
  }
}

const analysis = {
  totalIssues: allIssues.length,
  bySeverity: {
    critical: issuesBySeverity.critical.length,
    high: issuesBySeverity.high.length,
    medium: issuesBySeverity.medium.length,
    low: issuesBySeverity.low.length
  },
  criticalIssues: issuesBySeverity.critical.concat(issuesBySeverity.high),
  needsFix: issuesBySeverity.critical.length > 0 || issuesBySeverity.high.length > 0,
  issuesByFile: Object.fromEntries(
    Array.from(issuesByFile.entries()).map(([file, issues]) => [
      file,
      {
        count: issues.length,
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length
      }
    ])
  )
};

console.log(JSON.stringify(analysis, null, 2));

if (analysis.needsFix) {
  const fixInstructions = analysis.criticalIssues.map((issue, idx) => {
    return `${idx + 1}. [${(issue.severity || 'unknown').toUpperCase()}] ${issue.file}:${issue.line || 'N/A'}
   Category: ${issue.category || 'general'}
   Issue: ${issue.description || issue.message || 'No description'}
   ${issue.suggestion ? `Suggestion: ${issue.suggestion}` : ''}
`;
  }).join('\n');
  
  fs.writeFileSync(
    path.join(reviewDir, 'fix-instructions.txt'),
    `Critical and High Severity Issues:\n\n${fixInstructions}`
  );
}

process.exit(analysis.needsFix ? 1 : 0);
EOFJS

chmod +x scripts/review-tools/analyze-review.js

log "✓ Review analysis scripts configured"

# -----------------------
# Git 設定
# -----------------------
log "9. Configuring Git..."

git config user.name "OpenCode Bot"
git config user.email "opencode-bot@users.noreply.github.com"

log "✓ Git configured"

# -----------------------
# スナップショット作成
# -----------------------
log "10. Creating snapshot..."

SNAPSHOT_ID=""
if command -v vercel_snapshot_create &>/dev/null && [[ -n "${SANDBOX_ID:-}" && "$SANDBOX_ID" != "unknown" ]]; then
  SNAPSHOT_ID=$(vercel_snapshot_create "$SANDBOX_ID" "$SNAPSHOT_NAME")
else
  log "   (vercel_snapshot_create not found or no SANDBOX_ID; snapshot must be created by host)"
  log "   Host should call sandbox.snapshot() after this script completes."
  SNAPSHOT_ID="pending-host-snapshot"
fi

log "✅ Base environment ready for snapshot!"
log "   Snapshot ID: ${SNAPSHOT_ID:-<create via host>}"

# スナップショットIDを保存（ホストが後で書き換える場合もある）
echo "${SNAPSHOT_ID:-}" > snapshot-id.txt

cat << EOF

=============================================================================
✅ Base Snapshot Environment Ready
=============================================================================

Snapshot ID: ${SNAPSHOT_ID:-<create via host after this script>}

This environment contains:
- Repository cloned at '$BASE_BRANCH' branch
- OpenCode v${OPENCODE_VERSION} installed
- GitHub CLI v${GH_CLI_VERSION} installed
- npm dependencies installed (frontend/)
- AI Code Review (@bobmatnyc/ai-code-review) installed
- .ai-review-config.json (provider: gemini, model: gemini-3-flash-preview)
- scripts/review-tools/analyze-review.js
- Git configured

Ready for: Daily PR workflow (1 task = 1 branch = 1 session)

Next: If snapshot was not created in-script, host should call sandbox.snapshot()
      and use the returned snapshot ID in run-opencode-from-snapshot.sh
=============================================================================

EOF
