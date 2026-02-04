#!/usr/bin/env bash
# run-create-snapshot-via-cli.sh
# Vercel Sandbox CLI で create → create-base-snapshot.sh 実行 → snapshot まで行う
#
# 前提: npm/pnpm で sandbox CLI をインストールし、sandbox login 済み
#   pnpm i -g sandbox && sandbox login
#
# 使い方:
#   ./scripts/run-create-snapshot-via-cli.sh   # 対話形式で入力
#   REPO_URL=... ./scripts/run-create-snapshot-via-cli.sh   # 環境変数で上書き
#
# 参考: https://vercel.com/docs/vercel-sandbox/cli-reference

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_SCRIPT="${SCRIPT_DIR}/create-base-snapshot.sh"
# サンドボックス内の書き込み可能なパス（/app は Permission denied になるため /vercel/sandbox を使用）
SANDBOX_WORKDIR="${SANDBOX_WORKDIR:-/vercel/sandbox}"

log() { printf "[host] %s %s\n" "$(date +'%H:%M:%S')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# -----------------------
# 前提チェック
# -----------------------
if ! command -v sandbox &>/dev/null; then
  die "sandbox CLI not found. Install: pnpm i -g sandbox && sandbox login"
fi

if [[ ! -f "$SETUP_SCRIPT" ]]; then
  die "Setup script not found: $SETUP_SCRIPT"
fi

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
# 非公開リポの場合のみ。公開リポなら省略可
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  read -r -p "GitHub token（非公開リポ用、省略可）: " GITHUB_TOKEN
fi

echo ""
log "Using: REPO_URL=$REPO_URL BASE_BRANCH=$BASE_BRANCH SNAPSHOT_NAME=$SNAPSHOT_NAME SANDBOX_TIMEOUT=$SANDBOX_TIMEOUT"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  log "Using: GITHUB_TOKEN=*** (set)"
fi
echo ""

# オプション（CLI にそのまま渡す）。空配列の "${arr[@]}" は set -u で unbound になることがあるので関数で渡す
run_sandbox() {
  if ((${#SANDBOX_OPTS[@]} > 0)); then
    sandbox "${SANDBOX_OPTS[@]}" "$@"
  else
    sandbox "$@"
  fi
}
SANDBOX_OPTS=()
[[ -n "${VERCEL_TOKEN:-}" ]] && SANDBOX_OPTS+=(--token "$VERCEL_TOKEN")
[[ -n "${SANDBOX_PROJECT:-}" ]] && SANDBOX_OPTS+=(--project "$SANDBOX_PROJECT")
[[ -n "${SANDBOX_SCOPE:-}" ]] && SANDBOX_OPTS+=(--scope "$SANDBOX_SCOPE")

# -----------------------
# 1. Sandbox 作成
# -----------------------
log "1. Creating sandbox (timeout=${SANDBOX_TIMEOUT})..."
# 出力から Sandbox ID を抽出（sb_ または sbx_ で始まる）
CREATE_OUTPUT=$(run_sandbox create --timeout "$SANDBOX_TIMEOUT" 2>&1)
SANDBOX_ID=""
while IFS= read -r line; do
  if [[ "$line" =~ (sbx?_[a-zA-Z0-9]+) ]]; then
    SANDBOX_ID="${BASH_REMATCH[1]}"
    break
  fi
done <<< "$CREATE_OUTPUT"
[[ -z "$SANDBOX_ID" ]] && die "sandbox create failed (no ID). Output: $CREATE_OUTPUT"
log "   Sandbox ID: $SANDBOX_ID"

# 終了時に sandbox を stop する（snapshot で stop するので通常は不要だが保険）
cleanup() {
  if [[ -n "${SANDBOX_ID:-}" ]]; then
    log "Stopping sandbox $SANDBOX_ID..."
    run_sandbox stop "$SANDBOX_ID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# -----------------------
# 2. セットアップスクリプトをサンドボックスにコピー
# -----------------------
log "2. Copying create-base-snapshot.sh to sandbox..."
run_sandbox copy "$SETUP_SCRIPT" "${SANDBOX_ID}:${SANDBOX_WORKDIR}/create-base-snapshot.sh"

# -----------------------
# 3. サンドボックス内でスクリプト実行
# -----------------------
log "3. Running create-base-snapshot.sh inside sandbox..."

ENV_ARGS=()
[[ -n "${REPO_URL:-}" ]] && ENV_ARGS+=(--env "REPO_URL=$REPO_URL")
[[ -n "${BASE_BRANCH:-}" ]] && ENV_ARGS+=(--env "BASE_BRANCH=$BASE_BRANCH")
[[ -n "${SNAPSHOT_NAME:-}" ]] && ENV_ARGS+=(--env "SNAPSHOT_NAME=$SNAPSHOT_NAME")
[[ -n "${GITHUB_TOKEN:-}" ]] && ENV_ARGS+=(--env "GITHUB_TOKEN=$GITHUB_TOKEN")
# サンドボックス内では自 ID を渡す（スクリプトのログ用）
ENV_ARGS+=(--env "SANDBOX_ID=$SANDBOX_ID")

BASH_X="${DEBUG:+-x}"
if ! run_sandbox exec --workdir "$SANDBOX_WORKDIR" "${ENV_ARGS[@]}" "$SANDBOX_ID" bash $BASH_X create-base-snapshot.sh; then
  die "create-base-snapshot.sh failed in sandbox"
fi

log "   Setup script finished successfully."

# trap で stop すると snapshot 前に止まるので、snapshot を取るまでは stop しない
trap - EXIT

# -----------------------
# 4. スナップショット作成（CLI はホストで実行）
# -----------------------
log "4. Creating snapshot (sandbox will be stopped)..."
SNAPSHOT_OUTPUT=$(run_sandbox snapshot "$SANDBOX_ID" --stop 2>&1) || true
SANDBOX_ID=""

# 出力から snapshot ID を取得（snap_ で始まる）
SNAPSHOT_ID=""
while read -r line; do
  if [[ "$line" =~ (snap_[a-zA-Z0-9]+) ]]; then
    SNAPSHOT_ID="${BASH_REMATCH[1]}"
    break
  fi
done <<< "$SNAPSHOT_OUTPUT"

if [[ -z "$SNAPSHOT_ID" ]]; then
  log "Snapshot output: $SNAPSHOT_OUTPUT"
  die "Could not get snapshot ID from: sandbox snapshot"
fi

# -----------------------
# 結果
# -----------------------
log "Snapshot created: $SNAPSHOT_ID"
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
