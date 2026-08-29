#!/bin/bash
# SessionStart hook: prepare the workspace for Claude Code on the web.
# Installs the Worker's npm dependencies and the container's Go modules so
# typechecks, builds and vet runs work without a cold fetch mid-session.
set -euo pipefail

# Only run in remote (Claude Code on the web) sessions; local checkouts are
# assumed to be set up already.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

echo "Installing npm dependencies..."
npm install --no-fund --no-audit

echo "Downloading Go modules for container_src..."
(cd container_src && go mod download)

echo "Session start hook complete."
