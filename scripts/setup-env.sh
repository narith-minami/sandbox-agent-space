#!/usr/bin/env bash
# setup-env.sh
# .env.local をセットアップするヘルパースクリプト

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"

log() { echo "[$(date +'%H:%M:%S')] $*"; }

if [[ -f "$ENV_FILE" ]]; then
  log "⚠️  .env.local already exists at: $ENV_FILE"
  read -p "Overwrite? (y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log "Aborted"
    exit 0
  fi
fi

cat > "$ENV_FILE" << 'EOF'
# AI Code Review API Keys
# Choose one provider (Anthropic recommended for cost/speed)

# Anthropic Claude (推奨: 高速・低コスト)
# Get key: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=

# OpenAI GPT (代替)
# Get key: https://platform.openai.com/api-keys
# OPENAI_API_KEY=

# Google Gemini (代替)
# Get key: https://makersuite.google.com/app/apikey
# GEMINI_API_KEY=

# GitHub Token (for private repositories)
# Get token: https://github.com/settings/tokens
# Required scopes: repo
GITHUB_TOKEN=

# Vercel Token (optional, for Vercel Sandbox CLI)
# Get token: https://vercel.com/account/tokens
# VERCEL_TOKEN=
EOF

chmod 600 "$ENV_FILE"  # セキュリティのため読み書き制限

log "✅ Created template: $ENV_FILE"
log ""
log "Next steps:"
log "  1. Edit $ENV_FILE"
log "  2. Add your API keys (at least one AI provider)"
log "  3. Save the file"
log "  4. Run workflow scripts"
log ""
log "Get API keys from:"
log "  🔹 Anthropic (推奨): https://console.anthropic.com/settings/keys"
log "  🔹 OpenAI: https://platform.openai.com/api-keys"
log "  🔹 Gemini: https://makersuite.google.com/app/apikey"
log "  🔹 GitHub: https://github.com/settings/tokens"
log ""
log "Cost comparison (per 1M tokens):"
log "  - Claude Haiku: $0.25 (最安・推奨)"
log "  - GPT-4o-mini: $0.15"
log "  - Gemini Flash: Free tier available"

# エディタで開く（オプション）
if command -v code &>/dev/null; then
  read -p "Open in VS Code? (y/N): " open_editor
  if [[ "$open_editor" =~ ^[Yy]$ ]]; then
    code "$ENV_FILE"
  fi
elif command -v vim &>/dev/null; then
  read -p "Open in vim? (y/N): " open_editor
  if [[ "$open_editor" =~ ^[Yy]$ ]]; then
    vim "$ENV_FILE"
  fi
fi

log ""
log "✅ Setup complete! Edit $ENV_FILE to add your API keys."
