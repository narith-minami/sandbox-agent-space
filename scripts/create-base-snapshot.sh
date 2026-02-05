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

REPO_URL="${REPO_URL:-https://github.com/lbose-corp/yamachiku}"
BASE_BRANCH="${BASE_BRANCH:-staging}"
SNAPSHOT_NAME="${SNAPSHOT_NAME:-yamachiku-staging-ready}"
OPENCODE_VERSION="${OPENCODE_VERSION:-1.1.48}"
GH_CLI_VERSION="${GH_CLI_VERSION:-2.65.0}"

log "Creating base snapshot for daily PR workflow..."

# -----------------------
# Sandbox 作成（ホスト側で未作成の場合は環境変数 SANDBOX_ID を利用）
# -----------------------
if [[ -n "${SANDBOX_ID:-}" ]]; then
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
  "model": "github-copilot/claude-opus-4.5",
  "small_model": "github-copilot/gpt-4o-mini",
  "enabled_providers": ["github-copilot"],
  "disabled_providers": ["openai", "opencode"]
}
EOF

log "✓ OpenCode configured"

# -----------------------
# Git 設定
# -----------------------
log "6. Configuring Git..."

git config user.name "OpenCode Bot"
git config user.email "opencode-bot@users.noreply.github.com"

log "✓ Git configured"

# -----------------------
# スナップショット作成
# -----------------------
log "7. Creating snapshot..."

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
- Git configured

Ready for: Daily PR workflow (1 task = 1 branch = 1 session)

Next: If snapshot was not created in-script, host should call sandbox.snapshot()
      and use the returned snapshot ID in run-opencode-from-snapshot.sh
=============================================================================

EOF
