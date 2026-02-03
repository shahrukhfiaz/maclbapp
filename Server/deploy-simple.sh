#!/bin/bash

# Simple deployment script - run from Server directory
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${YELLOW}$1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

echo "=========================================="
echo "  Simple Deployment - Current Directory"
echo "=========================================="
echo ""

# Check if .env exists
print_info "Step 1: Checking environment file..."
if [ ! -f ".env" ]; then
    if [ -f "production.env" ]; then
        cp production.env .env
        print_success "Created .env from production.env"
    else
        print_error ".env file not found!"
        echo "Please create .env file first"
        echo "You can copy from your local production.env"
        exit 1
    fi
else
    print_success ".env file exists"
fi
echo ""

# Install dependencies
print_info "Step 2: Installing dependencies..."
npm install
print_success "Dependencies installed"
echo ""

# Generate Prisma Client
print_info "Step 3: Generating Prisma Client..."
npx prisma generate
print_success "Prisma Client generated"
echo ""

# Run migrations
print_info "Step 4: Running database migrations..."
npx prisma migrate deploy
print_success "Migrations completed"
echo ""

# Build application
print_info "Step 5: Building TypeScript..."
npm run build
print_success "Build completed"
echo ""

# Install Squid Proxy
print_info "Step 6: Installing Squid Proxy..."
if [ -f "install-squid-proxy.sh" ]; then
    chmod +x install-squid-proxy.sh
    ./install-squid-proxy.sh
    print_success "Squid Proxy installed"
else
    print_info "Skipping Squid (script not found)"
fi
echo ""

# Configure firewall
print_info "Step 7: Configuring firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 3128/tcp
print_success "Firewall configured"
echo ""

# Start with PM2
print_info "Step 8: Starting with PM2..."
pm2 stop digital-storming-loadboard 2>/dev/null || true
pm2 delete digital-storming-loadboard 2>/dev/null || true
pm2 start ecosystem.config.js --env production --name digital-storming-loadboard
pm2 save
pm2 startup systemd -u root --hp /root
print_success "Application started"
echo ""

# Verify
print_info "Step 9: Verifying deployment..."
sleep 3
if pm2 list | grep -q "digital-storming-loadboard.*online"; then
    print_success "Application is running!"
else
    print_error "Application failed to start"
    pm2 logs digital-storming-loadboard --lines 20
    exit 1
fi
echo ""

# Final status
echo "=========================================="
echo "  DEPLOYMENT SUCCESSFUL!"
echo "=========================================="
echo ""
echo "Application: http://$(curl -s ifconfig.me):3000"
echo "API Health: http://$(curl -s ifconfig.me):3000/api/v1/healthz"
echo "Admin Panel: http://$(curl -s ifconfig.me):3000"
echo ""
echo "Credentials:"
echo "  Email: superadmin@digitalstorming.com"
echo "  Password: ChangeMeSuperSecure123!"
echo ""
echo "Management commands:"
echo "  pm2 status"
echo "  pm2 logs digital-storming-loadboard"
echo "  pm2 restart digital-storming-loadboard"
echo ""
print_success "Ready to use!"

