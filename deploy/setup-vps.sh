#!/bin/bash
# ==========================================================================
# Script d'installation Nawras ERP sur VPS (Ubuntu 22.04 / Debian 12)
# Usage : sudo bash setup-vps.sh
# ==========================================================================

set -e

APP_DIR="/var/www/nawras-erp"
LOG_DIR="/var/log/nawras"
REPO_URL="https://github.com/mohamedlemane/nawras-erp.git"
NODE_VERSION="20"

echo "======================================================"
echo "  Installation Nawras ERP"
echo "======================================================"

# --- 1. Mise à jour système ---
echo "[1/9] Mise à jour du système..."
apt-get update -y && apt-get upgrade -y

# --- 2. Installer Node.js 20 ---
echo "[2/9] Installation Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# --- 3. Installer pnpm ---
echo "[3/9] Installation pnpm..."
npm install -g pnpm@latest

# --- 4. Installer PM2 ---
echo "[4/9] Installation PM2..."
npm install -g pm2

# --- 5. Installer Nginx ---
echo "[5/9] Installation Nginx..."
apt-get install -y nginx
systemctl enable nginx

# --- 6. Installer PostgreSQL ---
echo "[6/9] Installation PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Créer la base de données et l'utilisateur
echo "[6/9] Création base de données nawras_erp..."
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nawras') THEN
    CREATE USER nawras WITH PASSWORD 'ChangezMeEnProduction!';
  END IF;
END
\$\$;

CREATE DATABASE nawras_erp OWNER nawras;
GRANT ALL PRIVILEGES ON DATABASE nawras_erp TO nawras;
EOF

# --- 7. Cloner et configurer le projet ---
echo "[7/9] Clonage du projet..."
mkdir -p $APP_DIR $LOG_DIR
git clone $REPO_URL $APP_DIR || (cd $APP_DIR && git pull)

# Copier le fichier .env
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.production.example" "$APP_DIR/.env"
  echo ""
  echo "⚠️  IMPORTANT : Éditez le fichier $APP_DIR/.env et renseignez :"
  echo "    - DATABASE_URL"
  echo "    - SESSION_SECRET (chaîne aléatoire longue)"
  echo ""
  read -p "Appuyez sur Entrée après avoir édité le .env pour continuer..."
fi

# --- 8. Build de l'application ---
echo "[8/9] Build de l'application..."
cd $APP_DIR

# Installer les dépendances
pnpm install --frozen-lockfile

# Migrations base de données
pnpm --filter @workspace/db run migrate

# Seed super admin
pnpm --filter @workspace/db run seed:superadmin

# Build API
pnpm --filter @workspace/api-server run build

# Build Frontend
pnpm --filter @workspace/erp run build

# --- 9. Configurer PM2 et Nginx ---
echo "[9/9] Configuration PM2 et Nginx..."

# PM2
cd $APP_DIR
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

# Nginx
NGINX_CONF="/etc/nginx/sites-available/nawras-erp"
cp "$APP_DIR/deploy/nginx.conf" $NGINX_CONF
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/nawras-erp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "======================================================"
echo "  ✅ Installation terminée !"
echo "======================================================"
echo ""
echo "  Application accessible sur : http://$(curl -s ifconfig.me)"
echo ""
echo "  Identifiants Super Admin :"
echo "    Email    : admin@nawras.mr"
echo "    Mot de passe : Admin@2025!"
echo ""
echo "  Pour configurer HTTPS (SSL) :"
echo "    apt install certbot python3-certbot-nginx"
echo "    certbot --nginx -d VOTRE_DOMAINE"
echo ""
echo "  Logs :"
echo "    pm2 logs nawras-api"
echo "    tail -f $LOG_DIR/api-error.log"
echo "======================================================"
