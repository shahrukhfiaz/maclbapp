#!/bin/bash

# Digital Storming Loadboard - Production Deployment Script
# This script automates the deployment process for production

set -e

echo "🚀 Starting Digital Storming Loadboard Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found! Please create it from PRODUCTION_DEPLOYMENT.md"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js version check passed: $(node -v)"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
    print_success "PM2 installed successfully"
fi

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs
print_success "Logs directory created"

# Install dependencies
print_status "Installing production dependencies..."
npm ci --only=production
print_success "Dependencies installed"

# Build the application
print_status "Building application..."
npm run build
print_success "Application built successfully"

# Run database migrations
print_status "Running database migrations..."
npm run db:migrate
print_success "Database migrations completed"

# Stop existing PM2 processes
print_status "Stopping existing PM2 processes..."
pm2 stop digital-storming-loadboard 2>/dev/null || true
pm2 delete digital-storming-loadboard 2>/dev/null || true
print_success "Existing processes stopped"

# Start application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production
print_success "Application started with PM2"

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save
pm2 startup
print_success "PM2 configuration saved"

# Show PM2 status
print_status "PM2 Status:"
pm2 status

# Show logs
print_status "Recent logs:"
pm2 logs digital-storming-loadboard --lines 20

print_success "🎉 Deployment completed successfully!"
print_status "Your application is now running in production mode"
print_status "Check the logs with: pm2 logs digital-storming-loadboard"
print_status "Monitor with: pm2 monit"
print_status "Restart with: pm2 restart digital-storming-loadboard"

# Health check
print_status "Performing health check..."
sleep 5
if curl -f http://localhost:4000/api/v1/healthz > /dev/null 2>&1; then
    print_success "Health check passed! Application is responding"
else
    print_warning "Health check failed. Check the logs for issues"
fi
