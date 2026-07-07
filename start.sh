#!/usr/bin/env bash
# Single-service entrypoint for Render.
#
# The Express/Groq backend runs on an internal-only port (not exposed to the
# internet). The Next.js frontend is the public-facing process, listening on
# Render's assigned $PORT, and proxies /api/import to the backend over
# localhost (see frontend/src/app/api/import/route.ts).
set -euo pipefail

BACKEND_INTERNAL_PORT="${BACKEND_INTERNAL_PORT:-4000}"

# Start the backend in the background.
(cd backend && PORT="$BACKEND_INTERNAL_PORT" node dist/server.js) &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Tell the frontend's internal proxy where to find the backend.
export BACKEND_HOST="127.0.0.1"
export BACKEND_PORT="$BACKEND_INTERNAL_PORT"

cd frontend
exec npx next start -p "${PORT:-3000}"
