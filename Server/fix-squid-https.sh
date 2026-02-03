#!/bin/bash

# Fix Squid to properly handle HTTPS traffic
# This script updates the Squid configuration to allow HTTPS CONNECT method

echo "🔧 Fixing Squid HTTPS Configuration..."

# Backup current config
sudo cp /etc/squid/squid.conf /etc/squid/squid.conf.backup.$(date +%Y%m%d_%H%M%S)

# Check if the CONNECT rule already exists
if sudo grep -q "http_access allow CONNECT SSL_ports authenticated_users" /etc/squid/squid.conf; then
  echo "✅ HTTPS CONNECT rule already exists"
else
  echo "📝 Adding HTTPS CONNECT rule..."
  
  # Add CONNECT rule after the SSL_ports deny rule and before general http_access rules
  sudo sed -i '/http_access deny CONNECT !SSL_ports/a\
# Allow CONNECT method for HTTPS with authentication\
http_access allow CONNECT SSL_ports authenticated_users' /etc/squid/squid.conf
fi

# Restart Squid
echo "🔄 Restarting Squid..."
sudo systemctl restart squid

# Wait for Squid to start
sleep 2

# Check status
if sudo systemctl is-active --quiet squid; then
  echo "✅ Squid restarted successfully!"
  echo ""
  echo "📊 Squid Status:"
  sudo systemctl status squid --no-pager | head -15
else
  echo "❌ Squid failed to start!"
  echo ""
  echo "📋 Check logs:"
  echo "  sudo tail -50 /var/log/squid/cache.log"
  exit 1
fi

echo ""
echo "🧪 Testing HTTPS proxy..."
echo "Running: curl -x http://loadboard_proxy:PASSWORD@localhost:3128 https://httpbin.org/ip"

# URL-encode the password
PROXY_PASS_ENCODED=$(echo "DS!Pr0xy#2025\$Secur3" | sed 's/!/\%21/g; s/#/\%23/g; s/\$/\%24/g')

curl -x "http://loadboard_proxy:${PROXY_PASS_ENCODED}@localhost:3128" https://httpbin.org/ip -m 10

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ HTTPS proxy is working!"
else
  echo ""
  echo "❌ HTTPS proxy test failed"
  echo "Check Squid logs:"
  echo "  sudo tail -50 /var/log/squid/access.log"
  echo "  sudo tail -50 /var/log/squid/cache.log"
fi

