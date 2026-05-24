#!/usr/bin/env bash
# start-local.sh — Lance FishCall en local pour développement
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Vérifier Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js n'est pas installé. Installe-le depuis https://nodejs.org"
  exit 1
fi

# Créer .env si absent
if [ ! -f ".env" ]; then
  echo "📋 Création du fichier .env depuis .env.example…"
  cp .env.example .env
  echo "⚠️  Pense à remplir .env avec tes vraies valeurs (SMTP, VAPID…)"
fi

# Créer les répertoires nécessaires
mkdir -p data public/uploads logs

# Installer les dépendances si node_modules absent
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances…"
  npm install
fi

echo ""
echo "🎣 FishCall démarré !"
echo "   Page publique : http://localhost:3000"
echo "   Dashboard admin : http://localhost:3000/admin.html"
echo "   Mot de passe admin : fishcall2024 (ou ADMIN_PASSWORD dans .env)"
echo ""

node --watch server.js
