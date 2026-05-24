#!/usr/bin/env bash
# deploy.sh — Pull latest code & restart FishCall via Docker Compose
# Usage on VPS: ./deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[deploy] Pulling latest code…"
git pull origin main

echo "[deploy] Building & starting containers…"
docker compose pull 2>/dev/null || true
docker compose up -d --build --remove-orphans

echo "[deploy] Cleaning up old images…"
docker image prune -f

echo "[deploy] Done! Container status:"
docker compose ps
