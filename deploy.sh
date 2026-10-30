#!/bin/bash
# ==============================================================
# GlowSnake.io - Automated Ubuntu VPS Deployment Script
# RepoCloud / Ubuntu 22.04 / 24.04 compatible
# Baliyews Studio | Creator: Atəş Balıyev
# ==============================================================

set -e

echo "🚀 [GlowSnake.io] Starting automated VPS deployment..."

# 1. Update system packages
echo "📦 Updating apt packages..."
apt-get update -y
apt-get install -y curl git ufw

# 2. Check / Install Node.js 20 LTS if missing
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1)" != "v20" ]; then
  echo "⚡ Installing Node.js 20 LTS (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "✅ Node version: $(node -v)"
echo "✅ NPM version: $(npm -v)"

# 3. Install PM2 globally for background auto-restart process management
if ! command -v pm2 &> /dev/null; then
  echo "⚙️ Installing PM2 process manager..."
  npm install -g pm2
fi

# 4. Open firewall ports (Port 80, 443, 3000)
if command -v ufw &> /dev/null; then
  ufw allow 3000/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

# 5. Determine working directory
APP_DIR="/root/glowsnake-io"
if [ -d "$APP_DIR" ]; then
  echo "🔄 Updating existing repository at $APP_DIR..."
  cd "$APP_DIR"
  git fetch --all
  git reset --hard origin/main
else
  echo "📥 Cloning repository into $APP_DIR..."
  git clone https://github.com/AteshBaliyev/glowsnake-io.git "$APP_DIR"
  cd "$APP_DIR"
fi

# 6. Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# 7. Build Next.js application
echo "🔨 Building Next.js production bundle..."
npm run build

# 8. Start / Restart application via PM2
echo "🚀 Starting GlowSnake server with PM2..."
pm2 delete glowsnake-io 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "=========================================================="
echo "🎉 SUCCESS: GlowSnake.io server is live and running!"
echo "📍 Port: 3000"
echo "🌐 RepoCloud Domain: https://vps-2613da52.vps.rcld.dev"
echo "🔍 Check status anytime: pm2 status"
echo "📜 View live logs: pm2 logs glowsnake-io"
echo "=========================================================="
