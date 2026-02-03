#!/bin/bash

echo "🚀 Setting up Cloud Proxy Server on DigitalOcean Droplet"
echo "=================================================="

# Install http-proxy-middleware if not already installed
echo "📦 Installing proxy dependencies..."
npm install http-proxy-middleware express

# Create PM2 ecosystem file for proxy server
echo "⚙️ Creating PM2 configuration..."
cat > ecosystem.proxy.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'cloud-proxy',
    script: './cloud-proxy-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PROXY_PORT: 8080
    }
  }]
};
EOF

# Start the proxy server with PM2
echo "🌐 Starting proxy server..."
pm2 start ecosystem.proxy.config.js
pm2 save
pm2 startup

echo "✅ Cloud Proxy Server Setup Complete!"
echo ""
echo "📊 Proxy Server Status:"
pm2 status cloud-proxy
echo ""
echo "🔗 Test URLs:"
echo "   Health Check: http://157.230.51.160:8080/health"
echo "   IP Check:     http://157.230.51.160:8080/ip"
echo "   Proxy Test:   http://157.230.51.160:8080?url=https://httpbin.org/ip"
echo ""
echo "🌐 Your cloud server now has a proxy running on port 8080"
echo "   All traffic routed through this proxy will show IP: 157.230.51.160"