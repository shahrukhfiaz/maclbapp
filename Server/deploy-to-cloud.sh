#!/bin/bash

# Digital Storming Loadboard - Cloud Deployment Script
# This script deploys the application to a DigitalOcean droplet from GitHub

echo "🚀 Digital Storming Loadboard - Cloud Deployment"
echo "================================================"

# Check if droplet IP is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your droplet IP address"
    echo "Usage: ./deploy-to-cloud.sh YOUR_DROPLET_IP"
    echo "Example: ./deploy-to-cloud.sh 157.245.123.456"
    exit 1
fi

DROPLET_IP=$1
GITHUB_REPO="https://github.com/shahrukhfiaz/digital-storming-loadboard.git"
echo "🌐 Deploying to droplet: $DROPLET_IP"

echo ""
echo "📋 Automated Deployment Commands:"
echo "=================================="
echo ""
echo "1. Connect to your droplet:"
echo "   ssh root@$DROPLET_IP"
echo ""
echo "2. Run this command on the droplet:"
echo "   curl -fsSL https://raw.githubusercontent.com/shahrukhfiaz/digital-storming-loadboard/main/deploy-to-droplet.sh | bash -s $DROPLET_IP"
echo ""
echo "OR manually run these commands on the droplet:"
echo ""
echo "# Update system and install dependencies"
echo "apt update && apt upgrade -y"
echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
echo "apt-get install -y nodejs git postgresql-client"
echo "npm install -g pm2"
echo ""
echo "# Clone and setup application"
echo "git clone $GITHUB_REPO /root/digital-storming-loadboard"
echo "cd /root/digital-storming-loadboard"
echo "cp CLOUD_CONFIG.env .env"
echo "sed -i \"s/YOUR_DROPLET_IP/$DROPLET_IP/g\" .env"
echo ""
echo "# Install and start"
echo "npm install"
echo "npm run build"
echo "pm2 start dist/server.js --name loadboard-server"
echo "pm2 save"
echo "pm2 startup"
echo ""
echo "🎯 Result:"
echo "=========="
echo "• Server accessible at: http://$DROPLET_IP:4000"
echo "• All Chromium browsing will route through: $DROPLET_IP"
echo "• User IPs will be masked by cloud server IP"
echo "• API endpoint: http://$DROPLET_IP:4000/api/v1/healthz"
echo ""
echo "✅ Deployment commands ready!"
