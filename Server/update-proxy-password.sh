#!/bin/bash

# Update Squid proxy password to one without special characters
# This makes it more compatible with Electron's proxy authentication

echo "🔧 Updating Squid proxy password..."

# New simpler password (no special characters that need encoding)
NEW_PASSWORD="LoadBoardProxy2025"

# Remove old password file
sudo rm -f /etc/squid/passwords

# Create new password
echo "Creating password for user: loadboard_proxy"
sudo htpasswd -bc /etc/squid/passwords loadboard_proxy "$NEW_PASSWORD"

# Set proper permissions
sudo chown proxy:proxy /etc/squid/passwords
sudo chmod 640 /etc/squid/passwords

echo "✅ Password updated!"
echo ""
echo "📋 New Credentials:"
echo "   Username: loadboard_proxy"
echo "   Password: $NEW_PASSWORD"
echo ""

# Restart Squid
echo "🔄 Restarting Squid..."
sudo systemctl restart squid

# Wait for startup
sleep 2

if sudo systemctl is-active --quiet squid; then
    echo "✅ Squid restarted successfully!"
    echo ""
    echo "🧪 Testing with new password..."
    
    # Test the proxy
    RESULT=$(curl -x "http://loadboard_proxy:${NEW_PASSWORD}@localhost:3128" https://httpbin.org/ip -s -m 10)
    
    if [ $? -eq 0 ]; then
        echo "✅ HTTPS proxy working with new password!"
        echo "Response: $RESULT"
    else
        echo "❌ Test failed"
    fi
else
    echo "❌ Squid failed to start!"
fi

echo ""
echo "📝 Update client .env file with:"
echo "   PROXY_PASSWORD=LoadBoardProxy2025"

