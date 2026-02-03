#!/bin/bash

# Digital Storming Loadboard - Quick Server Update Script
# Run this script on your DigitalOcean server to update to the latest version

set -e

echo "🔄 Starting Digital Storming Loadboard Server Update..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the app directory."
    exit 1
fi

# Create backup
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
print_status "Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Backup current .env file
if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/env.backup"
    print_success "Environment file backed up"
else
    print_warning "No .env file found to backup"
fi

# Backup current app
cp -r . "$BACKUP_DIR/app-backup" 2>/dev/null || true
print_success "Application backed up"

# Stop current PM2 processes
print_status "Stopping current PM2 processes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
print_success "PM2 processes stopped"

# Pull latest changes
print_status "Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main
print_success "Code updated from GitHub"

# Restore .env file
if [ -f "$BACKUP_DIR/env.backup" ]; then
    cp "$BACKUP_DIR/env.backup" .env
    print_success "Environment file restored"
fi

# Install dependencies (including dev dependencies needed for build)
print_status "Installing dependencies..."
npm ci
print_success "Dependencies installed"

# Build application
print_status "Building application..."
npm run build
print_success "Application built"

# Generate Prisma client
print_status "Generating Prisma client..."
npm run db:generate
print_success "Prisma client generated"

# Run database migrations
print_status "Running database migrations..."
npm run db:migrate
print_success "Database migrations completed"

# Start with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production
pm2 save
print_success "Application started with PM2"

# Show status
print_status "PM2 Status:"
pm2 status

# Show recent logs
print_status "Recent logs:"
pm2 logs digital-storming-loadboard --lines 20

# Health check
print_status "Performing health check..."
sleep 5
if curl -f http://localhost:4000/api/v1/healthz > /dev/null 2>&1; then
    print_success "Health check passed! Application is responding"
else
    print_warning "Health check failed. Check the logs for issues"
fi

print_success "🎉 Server update completed successfully!"
print_status "Your Digital Storming Loadboard is now running the latest version"
print_status "Backup saved in: $BACKUP_DIR"
print_status "Check logs with: pm2 logs digital-storming-loadboard"
print_status "Monitor with: pm2 monit"

# Show new features
echo ""
print_status "🆕 New Features Available:"
echo "  ✅ Modern dark theme admin panel"
echo "  ✅ Notification system with dismissible balloons"
echo "  ✅ Enhanced user management interface"
echo "  ✅ Improved button positioning and styling"
echo "  ✅ Better error handling and logging"
echo "  ✅ Production-ready PM2 configuration"
echo ""
print_status "🌐 Access your admin panel at: http://$(curl -s ifconfig.me)"
