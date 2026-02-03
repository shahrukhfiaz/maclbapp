#!/bin/bash

# DAT Loadboard Server Deployment Script
# This script deploys the server from GitHub repository

set -e

echo "=========================================="
echo "DAT Loadboard Server Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/shahrukhfiaz/lb2new.git"
APP_DIR="/root/dat-loadboard"
SERVER_DIR="$APP_DIR/Server"
PORT=3000

echo -e "${GREEN}Step 1: Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

echo -e "${GREEN}Step 2: Installing required dependencies...${NC}"

# Install Node.js 18.x if not installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Install PostgreSQL client if not installed
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL client..."
    apt-get install -y postgresql-client
fi

# Install Git if not installed
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    apt-get install -y git
fi

# Install build tools
apt-get install -y build-essential

echo -e "${GREEN}Step 3: Cloning/updating repository...${NC}"
if [ -d "$APP_DIR" ]; then
    echo "Repository exists, updating..."
    cd "$APP_DIR"
    git pull origin main || {
        echo "Git pull failed, removing and re-cloning..."
        cd /root
        rm -rf "$APP_DIR"
        git clone "$REPO_URL" "$APP_DIR"
    }
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
fi

cd "$SERVER_DIR"

echo -e "${GREEN}Step 4: Setting up environment variables...${NC}"
if [ ! -f .env ]; then
    echo "Creating .env file from production.env..."
    if [ -f production.env ]; then
        cp production.env .env
        echo -e "${YELLOW}⚠️  Please edit .env file with your actual credentials!${NC}"
    else
        echo -e "${RED}Error: production.env not found!${NC}"
        exit 1
    fi
else
    echo ".env file already exists, skipping..."
fi

echo -e "${GREEN}Step 5: Installing Node.js dependencies...${NC}"
npm install

echo -e "${GREEN}Step 6: Generating Prisma client...${NC}"
npm run db:generate

echo -e "${GREEN}Step 7: Running database migrations...${NC}"
npm run db:migrate

echo -e "${GREEN}Step 8: Building TypeScript...${NC}"
npm run build

echo -e "${GREEN}Step 9: Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp
    ufw allow 22/tcp
    echo "Firewall configured"
else
    echo "UFW not installed, skipping firewall configuration"
fi

echo -e "${GREEN}Step 10: Starting application with PM2...${NC}"
# Stop existing PM2 process if running
pm2 stop dat-loadboard-server || true
pm2 delete dat-loadboard-server || true

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo -e "${GREEN}Step 11: Verifying deployment...${NC}"
sleep 5

# Check if PM2 process is running
if pm2 list | grep -q "dat-loadboard-server.*online"; then
    echo -e "${GREEN}✅ Server is running!${NC}"
    pm2 status
else
    echo -e "${RED}❌ Server failed to start. Check logs with: pm2 logs dat-loadboard-server${NC}"
    exit 1
fi

# Test health endpoint
echo -e "${GREEN}Testing health endpoint...${NC}"
sleep 3
if curl -f http://localhost:$PORT/api/v1/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed, but server may still be starting...${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Server URL: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "Admin Panel: http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo "Useful commands:"
echo "  View logs: pm2 logs dat-loadboard-server"
echo "  Restart: pm2 restart dat-loadboard-server"
echo "  Status: pm2 status"
echo "  Stop: pm2 stop dat-loadboard-server"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "  1. Edit .env file with your actual credentials"
echo "  2. Configure database connection"
echo "  3. Set up DigitalOcean Spaces credentials"
echo "  4. Configure JWT secrets"
echo ""

