#!/bin/bash

# Hot fix deployment for login issue
# Run this on the server to fix the foreign key constraint error

echo "🔧 Deploying login fix..."

cd ~/digital-storming-loadboard-v2/Server || exit 1

# Pull latest changes if using git
if [ -d ".git" ]; then
  echo "📥 Pulling latest changes from git..."
  git pull
fi

# Install dependencies (in case anything changed)
echo "📦 Installing dependencies..."
npm install --production

# Build the TypeScript code
echo "🏗️  Building application..."
npm run build

# Restart PM2
echo "🔄 Restarting application..."
pm2 restart digital-storming-loadboard

echo "✅ Deployment complete!"
echo ""
echo "📊 Checking application status..."
pm2 status digital-storming-loadboard

echo ""
echo "📋 Recent logs:"
pm2 logs digital-storming-loadboard --lines 20 --nostream

