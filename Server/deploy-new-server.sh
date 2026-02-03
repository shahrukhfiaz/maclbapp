#!/bin/bash

###############################################################################
# Digital Storming Loadboard V2 - Automated Deployment Script
# Server: 67.205.189.32
# Date: 2025-10-28
###############################################################################

set -e  # Exit on error

echo "=========================================="
echo "Digital Storming Loadboard V2 Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

print_info "Starting deployment process..."
echo ""

# Step 1: System Update
print_info "Step 1: Updating system packages..."
apt update -y && apt upgrade -y
print_success "System packages updated"
echo ""

# Step 2: Install Node.js 18
print_info "Step 2: Installing Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    print_success "Node.js installed: $(node -v)"
else
    print_success "Node.js already installed: $(node -v)"
fi
echo ""

# Step 3: Install PM2
print_info "Step 3: Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    print_success "PM2 installed"
else
    print_success "PM2 already installed"
fi
echo ""

# Step 4: Install PostgreSQL client (for psql)
print_info "Step 4: Installing PostgreSQL client..."
apt install -y postgresql-client
print_success "PostgreSQL client installed"
echo ""

# Step 5: Setup application directory
print_info "Step 5: Setting up application directory..."
APP_DIR="/root/digital-storming-loadboard-v2"

if [ -d "$APP_DIR" ]; then
    print_info "Directory exists, backing up..."
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"
print_success "Application directory ready: $APP_DIR"
echo ""

# Step 6: Clone or copy repository
print_info "Step 6: Repository setup..."
print_info "Please ensure your code is uploaded to this directory: $APP_DIR"
print_info "You can use: scp, git clone, or rsync"
echo ""
read -p "Press ENTER when repository is ready in $APP_DIR/Server..."

# Navigate to Server directory
cd "$APP_DIR/Server"
print_success "Repository ready"
echo ""

# Step 7: Setup environment file
print_info "Step 7: Setting up environment configuration..."
if [ -f "production.env" ]; then
    cp production.env .env
    print_success "Environment file created from production.env"
else
    print_error "production.env not found! Please create it first."
    exit 1
fi
echo ""

# Step 8: Install dependencies
print_info "Step 8: Installing dependencies..."
npm install --production
print_success "Dependencies installed"
echo ""

# Step 9: Setup DigitalOcean Spaces bucket
print_info "Step 9: Creating DigitalOcean Spaces bucket..."
print_info "Please manually create the bucket 'ds-loadboard-sessions-v2' in DigitalOcean Spaces (NYC3)"
print_info "URL: https://cloud.digitalocean.com/spaces"
echo ""
read -p "Press ENTER when bucket is created..."
print_success "Bucket setup confirmed"
echo ""

# Step 10: Test database connection
print_info "Step 10: Testing database connection..."
if psql "postgresql://neondb_owner:npg_qHPECT6yZgd7@ep-tiny-bush-a012rwq3-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" -c "SELECT 1;" &> /dev/null; then
    print_success "Database connection successful"
else
    print_error "Database connection failed"
    exit 1
fi
echo ""

# Step 11: Generate Prisma Client
print_info "Step 11: Generating Prisma Client..."
npx prisma generate
print_success "Prisma Client generated"
echo ""

# Step 12: Run database migrations
print_info "Step 12: Running database migrations..."
npx prisma migrate deploy
print_success "Database migrations completed"
echo ""

# Step 13: Build application
print_info "Step 13: Building application..."
npm run build
print_success "Application built successfully"
echo ""

# Step 14: Install and configure Squid Proxy
print_info "Step 14: Installing Squid Proxy with authentication..."
if [ -f "install-squid-proxy.sh" ]; then
    chmod +x install-squid-proxy.sh
    ./install-squid-proxy.sh
    print_success "Squid Proxy installed and configured"
else
    print_info "Skipping Squid installation (script not found)"
    print_info "You can run install-squid-proxy.sh manually later"
fi
echo ""

# Step 15: Configure firewall
print_info "Step 15: Configuring firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (future)
ufw allow 3000/tcp  # API
ufw allow 3128/tcp  # Squid Proxy
print_success "Firewall configured"
echo ""

# Step 16: Start application with PM2
print_info "Step 16: Starting application with PM2..."

# Stop existing instance if running
pm2 stop digital-storming-loadboard 2>/dev/null || true
pm2 delete digital-storming-loadboard 2>/dev/null || true

# Start new instance
pm2 start ecosystem.config.js --env production --name digital-storming-loadboard
print_success "Application started"
echo ""

# Step 17: Save PM2 configuration
print_info "Step 17: Saving PM2 configuration..."
pm2 save
print_success "PM2 configuration saved"
echo ""

# Step 18: Setup PM2 startup
print_info "Step 18: Setting up PM2 auto-start..."
pm2 startup systemd -u root --hp /root
print_success "PM2 startup configured"
echo ""

# Step 19: Verify deployment
print_info "Step 19: Verifying deployment..."
sleep 5

if pm2 list | grep -q "digital-storming-loadboard.*online"; then
    print_success "Application is running"
else
    print_error "Application is not running"
    pm2 logs digital-storming-loadboard --lines 50
    exit 1
fi

# Test health endpoint
if curl -f http://localhost:3000/api/v1/healthz &> /dev/null; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    exit 1
fi
echo ""

# Final status
echo ""
echo "=========================================="
echo "         DEPLOYMENT SUCCESSFUL!           "
echo "=========================================="
echo ""
print_success "Server is running at: http://67.205.189.32:3000"
print_success "Admin Panel: http://67.205.189.32:3000"
print_success "API Base: http://67.205.189.32:3000/api/v1"
echo ""
print_info "Useful commands:"
echo "  pm2 status                           - Check application status"
echo "  pm2 logs digital-storming-loadboard  - View logs"
echo "  pm2 restart digital-storming-loadboard - Restart application"
echo "  pm2 stop digital-storming-loadboard  - Stop application"
echo ""
print_info "Next steps:"
echo "  1. Test login: http://67.205.189.32:3000"
echo "  2. Build client application"
echo "  3. Update DAT credentials in .env"
echo "  4. Test end-to-end"
echo ""
print_info "View logs:"
pm2 logs digital-storming-loadboard --lines 20

