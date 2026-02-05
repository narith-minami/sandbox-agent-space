#!/usr/bin/env bash
# run-create-snapshot-via-cli.sh
# Vercel Sandbox CLI で create → create-base-snapshot.sh 実行 → snapshot まで行う
#
# 前提: npm/pnpm で sandbox CLI をインストールし、sandbox login 済み
#   npm i -g @vercel/sandbox-cli && sandbox login
#
# 使い方:
#   ./scripts/run-create-snapshot-via-cli.sh   # 対話形式で入力
#   REPO_URL=... ./scripts/run-create-snapshot-via-cli.sh   # 環境変数で上書き
#
# 参考: https://vercel.com/docs/vercel-sandbox/cli-reference

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_SCRIPT="${SCRIPT_DIR}/create-base-snapshot.sh"
# サンドボックス内の書き込み可能なパス
SANDBOX_WORKDIR="${SANDBOX_WORKDIR:-/vercel/sandbox}"

log() { printf "[host] %s %s\n" "$(date +'%H:%M:%S')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# -----------------------
# 前提チェック
# -----------------------
log "Checking prerequisites..."

if ! command -v sandbox &>/dev/null; then
  cat << 'EOF'
❌ sandbox CLI not found!

Install it with:
  npm install -g @vercel/sandbox-cli

Or with pnpm:
  pnpm add -g @vercel/sandbox-cli

Then login:
  sandbox login

For more info: https://vercel.com/docs/vercel-sandbox/cli-reference
EOF
  die "sandbox CLI not found"
fi

log "✓ sandbox CLI found: $(sandbox --version 2>&1 | head -1 || echo 'version unknown')"

# ログイン状態確認（sandbox whoami はないため、認証が必要な list で確認）
if ! sandbox list &>/dev/null; then
  cat << 'EOF'
❌ Not logged in to Vercel Sandbox!

Please login first:
  sandbox login

Then try again.
EOF
  die "Not logged in to sandbox"
fi

log "✓ Logged in to Vercel Sandbox"

if [[ ! -f "$SETUP_SCRIPT" ]]; then
  die "Setup script not found: $SETUP_SCRIPT"
fi

log "✓ Setup script found: $SETUP_SCRIPT"

# -----------------------
# 対話形式で引数入力（環境変数が未設定のときのみプロンプト）
# -----------------------
prompt_with_default() {
  local label="$1"
  local default="$2"
  local val=""
  read -r -p "${label} [${default}]: " val
  printf '%s' "${val:-$default}"
}

echo ""
echo "=== スナップショット作成の設定（Enter で既定値） ==="

if [[ -z "${REPO_URL:-}" ]]; then
  REPO_URL=$(prompt_with_default "リポジトリ URL" "https://github.com/lbose-corp/yamachiku")
fi

if [[ -z "${BASE_BRANCH:-}" ]]; then
  BASE_BRANCH=$(prompt_with_default "ベースブランチ" "staging")
fi

if [[ -z "${SNAPSHOT_NAME:-}" ]]; then
  SNAPSHOT_NAME=$(prompt_with_default "スナップショット名" "yamachiku-staging-ready")
fi

if [[ -z "${SANDBOX_TIMEOUT:-}" ]]; then
  SANDBOX_TIMEOUT=$(prompt_with_default "サンドボックス timeout (例: 20m, 1h)" "20m")
fi

# 数字だけの場合は分として扱う（CLI は 10m / 1h 形式を要求）
if [[ "$SANDBOX_TIMEOUT" =~ ^[0-9]+$ ]]; then
  SANDBOX_TIMEOUT="${SANDBOX_TIMEOUT}m"
fi

# オプション（空でもよい）
if [[ -z "${SANDBOX_PROJECT:-}" ]]; then
  read -r -p "Vercel project（省略可、Enter でスキップ）: " SANDBOX_PROJECT
fi

if [[ -z "${SANDBOX_SCOPE:-}" ]]; then
  read -r -p "Vercel scope/team（省略可、Enter でスキップ）: " SANDBOX_SCOPE
fi

# 非公開リポの場合のみ
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  read -r -p "GitHub token（非公開リポ用、省略可）: " GITHUB_TOKEN
fi

echo ""
log "Configuration:"
log "  REPO_URL=$REPO_URL"
log "  BASE_BRANCH=$BASE_BRANCH"
log "  SNAPSHOT_NAME=$SNAPSHOT_NAME"
log "  SANDBOX_TIMEOUT=$SANDBOX_TIMEOUT"
[[ -n "${SANDBOX_PROJECT:-}" ]] && log "  PROJECT=$SANDBOX_PROJECT"
[[ -n "${SANDBOX_SCOPE:-}" ]] && log "  SCOPE=$SANDBOX_SCOPE"
[[ -n "${GITHUB_TOKEN:-}" ]] && log "  GITHUB_TOKEN=*** (set)"
echo ""

# オプション配列の構築
SANDBOX_OPTS=()
[[ -n "${VERCEL_TOKEN:-}" ]] && SANDBOX_OPTS+=(--token "$VERCEL_TOKEN")
[[ -n "${SANDBOX_PROJECT:-}" ]] && SANDBOX_OPTS+=(--project "$SANDBOX_PROJECT")
[[ -n "${SANDBOX_SCOPE:-}" ]] && SANDBOX_OPTS+=(--scope "$SANDBOX_SCOPE")

# Helper function
run_sandbox() {
  if ((${#SANDBOX_OPTS[@]} > 0)); then
    sandbox "${SANDBOX_OPTS[@]}" "$@"
  else
    sandbox "$@"
  fi
}

# -----------------------
# 1. Sandbox 作成
# -----------------------
log "Step 1/4: Creating sandbox (timeout=${SANDBOX_TIMEOUT})..."

# デバッグ: 実行コマンドを表示
log "DEBUG: Running command:"
if ((${#SANDBOX_OPTS[@]} > 0)); then
  log "  sandbox ${SANDBOX_OPTS[*]} create --timeout $SANDBOX_TIMEOUT"
else
  log "  sandbox create --timeout $SANDBOX_TIMEOUT"
fi

# Sandbox作成（詳細な出力を保持）
CREATE_OUTPUT=$(run_sandbox create --timeout "$SANDBOX_TIMEOUT" 2>&1) || {
  EXIT_CODE=$?
  log "❌ sandbox create failed with exit code: $EXIT_CODE"
  log "Output:"
  echo "$CREATE_OUTPUT"
  die "Failed to create sandbox"
}

log "Sandbox create output:"
echo "$CREATE_OUTPUT"

# Sandbox ID を抽出（sb_ または sbx_ で始まる）
SANDBOX_ID=""
while IFS= read -r line; do
  if [[ "$line" =~ (sbx?_[a-zA-Z0-9]+) ]]; then
    SANDBOX_ID="${BASH_REMATCH[1]}"
    break
  fi
done <<< "$CREATE_OUTPUT"

if [[ -z "$SANDBOX_ID" ]]; then
  log "❌ Could not extract sandbox ID from output"
  log "Full output was:"
  echo "$CREATE_OUTPUT"
  die "sandbox create failed (no ID found)"
fi

log "✓ Sandbox created: $SANDBOX_ID"

# 終了時に sandbox を stop する
cleanup() {
  if [[ -n "${SANDBOX_ID:-}" ]]; then
    log "Stopping sandbox $SANDBOX_ID..."
    run_sandbox stop "$SANDBOX_ID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Sandboxが実際に起動するまで少し待つ
log "Waiting for sandbox to be ready..."
sleep 5

# -----------------------
# 2. セットアップスクリプトをサンドボックスにコピー
# -----------------------
log "Step 2/4: Copying create-base-snapshot.sh to sandbox..."

if ! run_sandbox copy "$SETUP_SCRIPT" "${SANDBOX_ID}:${SANDBOX_WORKDIR}/create-base-snapshot.sh" 2>&1; then
  die "Failed to copy setup script to sandbox"
fi

log "✓ Script copied to sandbox"

# -----------------------
# 3. サンドボックス内でスクリプト実行
# -----------------------
log "Step 3/4: Running create-base-snapshot.sh inside sandbox..."

# 環境変数配列の構築
ENV_ARGS=()
[[ -n "${REPO_URL:-}" ]] && ENV_ARGS+=(--env "REPO_URL=$REPO_URL")
[[ -n "${BASE_BRANCH:-}" ]] && ENV_ARGS+=(--env "BASE_BRANCH=$BASE_BRANCH")
[[ -n "${SNAPSHOT_NAME:-}" ]] && ENV_ARGS+=(--env "SNAPSHOT_NAME=$SNAPSHOT_NAME")
[[ -n "${GITHUB_TOKEN:-}" ]] && ENV_ARGS+=(--env "GITHUB_TOKEN=$GITHUB_TOKEN")
ENV_ARGS+=(--env "SANDBOX_ID=$SANDBOX_ID")

# デバッグモード
BASH_X="${DEBUG:+-x}"

log "Executing script in sandbox..."
EXEC_OUTPUT=$(run_sandbox exec --workdir "$SANDBOX_WORKDIR" "${ENV_ARGS[@]}" "$SANDBOX_ID" bash $BASH_X create-base-snapshot.sh 2>&1) || {
  EXIT_CODE=$?
  log "❌ Script execution failed with exit code: $EXIT_CODE"
  log "Output:"
  echo "$EXEC_OUTPUT"
  die "create-base-snapshot.sh failed in sandbox"
}

log "Script output:"
echo "$EXEC_OUTPUT"

log "✓ Setup script finished successfully"

# trap で stop すると snapshot 前に止まるので、ここで解除
trap - EXIT

# -----------------------
# 4. スナップショット作成（CLI はホストで実行）
# -----------------------
log "Step 4/4: Creating snapshot (sandbox will be stopped)..."

SNAPSHOT_OUTPUT=$(run_sandbox snapshot "$SANDBOX_ID" --stop 2>&1) || {
  EXIT_CODE=$?
  log "❌ Snapshot creation failed with exit code: $EXIT_CODE"
  log "Output:"
  echo "$SNAPSHOT_OUTPUT"
  die "Failed to create snapshot"
}

log "Snapshot output:"
echo "$SNAPSHOT_OUTPUT"

# Sandbox ID をクリア（既に停止済み）
SANDBOX_ID=""

# 出力から snapshot ID を取得（snap_ で始まる）
SNAPSHOT_ID=""
while IFS= read -r line; do
  if [[ "$line" =~ (snap_[a-zA-Z0-9]+) ]]; then
    SNAPSHOT_ID="${BASH_REMATCH[1]}"
    break
  fi
done <<< "$SNAPSHOT_OUTPUT"

if [[ -z "$SNAPSHOT_ID" ]]; then
  log "❌ Could not extract snapshot ID from output"
  log "Full output was:"
  echo "$SNAPSHOT_OUTPUT"
  die "Could not get snapshot ID"
fi

# -----------------------
# 結果
# -----------------------
log "✓ Snapshot created: $SNAPSHOT_ID"
echo "$SNAPSHOT_ID" > "$SCRIPT_DIR/snapshot-id.txt"

cat << EOF

=============================================================================
✅ Snapshot created via Sandbox CLI
=============================================================================

Snapshot ID: $SNAPSHOT_ID

Use when creating sandboxes:
  sandbox create --snapshot $SNAPSHOT_ID

Or set in env:
  export SNAPSHOT_ID=$SNAPSHOT_ID

Saved to: $SCRIPT_DIR/snapshot-id.txt

=============================================================================

EOF

log "✅ Snapshot creation workflow completed successfully!"
