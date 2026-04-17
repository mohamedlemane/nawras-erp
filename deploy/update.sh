#!/bin/bash
# ==========================================================================
# Script de mise à jour Nawras ERP (à exécuter sur le VPS)
# Usage : cd /var/www/nawras-erp && bash deploy/update.sh
# ==========================================================================

set -e
APP_DIR="/var/www/nawras-erp"
cd $APP_DIR

echo "🔄 Mise à jour Nawras ERP..."

# 1. Récupérer les dernières modifications
echo "[1/5] git pull..."
git pull origin main

# 2. Installer les nouvelles dépendances
echo "[2/5] pnpm install..."
pnpm install --frozen-lockfile

# 3. Migrations (si nouvelles migrations)
echo "[3/5] Migrations..."
pnpm --filter @workspace/db run migrate

# 4. Rebuild
echo "[4/5] Build..."
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/erp run build

# 5. Redémarrer le backend
echo "[5/5] Redémarrage..."
pm2 restart nawras-api

echo "✅ Mise à jour terminée !"
pm2 status
