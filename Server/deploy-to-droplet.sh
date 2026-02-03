#!/bin/bash

# Digital Storming Loadboard - Droplet Deployment Script
# This script runs ON the DigitalOcean droplet to setup the application

echo "🚀 Digital Storming Loadboard - Droplet Setup"
echo "============================================="

DROPLET_IP=$1
GITHUB_REPO="https://github.com/shahrukhfiaz/digital-storming-loadboard.git"

if [ -z "$DROPLET_IP" ]; then
    echo "❌ Error: Droplet IP not provided"
    echo "Usage: curl -fsSL https://raw.githubusercontent.com/shahrukhfiaz/digital-storming-loadboard/main/deploy-to-droplet.sh | bash -s YOUR_DROPLET_IP"
    exit 1
fi

echo "🌐 Setting up droplet: $DROPLET_IP"
echo "📦 Installing dependencies..."

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install Git and other utilities
apt install -y git curl wget

echo "✅ Dependencies installed"

# Clone the repository
echo "📥 Cloning repository..."
if [ -d "/root/digital-storming-loadboard" ]; then
    echo "📁 Directory exists, updating..."
    cd /root/digital-storming-loadboard
    git pull origin main
else
    git clone $GITHUB_REPO /root/digital-storming-loadboard
    cd /root/digital-storming-loadboard
fi

echo "✅ Repository cloned/updated"

# Setup environment
echo "⚙️ Setting up environment..."
cp CLOUD_CONFIG.env .env
sed -i "s/YOUR_DROPLET_IP/$DROPLET_IP/g" .env

# Generate a secure JWT secret if not set
if grep -q "your-super-secret-jwt-key-change-this-in-production" .env; then
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env
    echo "🔐 Generated secure JWT secret"
fi

echo "✅ Environment configured"

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo "✅ Dependencies installed"

# Build the application
echo "🔨 Building application..."
npm run build

echo "✅ Application built"

# Setup PM2
echo "🚀 Starting application with PM2..."
pm2 stop loadboard-server 2>/dev/null || true
pm2 delete loadboard-server 2>/dev/null || true
pm2 start dist/server.js --name loadboard-server
pm2 save
pm2 startup

echo "✅ Application started with PM2"

# Test the application
echo "🧪 Testing application..."
sleep 5

if curl -f http://localhost:4000/api/v1/healthz > /dev/null 2>&1; then
    echo "✅ Application is running successfully!"
    echo "🌐 Server accessible at: http://$DROPLET_IP:4000"
    echo "📊 Health check: http://$DROPLET_IP:4000/api/v1/healthz"
else
    echo "❌ Application failed to start. Check logs with: pm2 logs loadboard-server"
    exit 1
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo "✅ Server running at: http://$DROPLET_IP:4000"
echo "✅ API endpoint: http://$DROPLET_IP:4000/api/v1/healthz"
echo "✅ All browsing will route through: $DROPLET_IP"
echo ""
echo "📋 Next Steps:"
echo "1. Update your client app's .env file with:"
echo "   API_BASE_URL=https://$DROPLET_IP/api/v1"
echo "   CLOUD_SERVER_IP=$DROPLET_IP"
echo ""
echo "2. Test IP masking by visiting httpbin.org/ip in DAT"
echo ""
echo "🛠️ Useful Commands:"
echo "• View logs: pm2 logs loadboard-server"
echo "• Restart: pm2 restart loadboard-server"
echo "• Status: pm2 status"
echo ""
echo "🎯 Your cloud server is ready for global access with IP masking!"
