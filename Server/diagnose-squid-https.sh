#!/bin/bash

echo "🔍 Diagnosing Squid HTTPS Issue..."
echo ""

echo "1️⃣  Checking Squid Configuration:"
echo "================================"
echo ""
echo "📋 SSL_ports ACL:"
sudo grep -n "acl SSL_ports" /etc/squid/squid.conf
echo ""

echo "📋 CONNECT rules:"
sudo grep -n "CONNECT" /etc/squid/squid.conf | grep -v "^#"
echo ""

echo "📋 Authentication rules:"
sudo grep -n "authenticated_users" /etc/squid/squid.conf | grep -v "^#"
echo ""

echo "📋 All http_access rules (in order):"
sudo grep -n "http_access" /etc/squid/squid.conf | grep -v "^#" | head -20
echo ""

echo "2️⃣  Checking Recent Access Logs:"
echo "================================"
sudo tail -20 /var/log/squid/access.log
echo ""

echo "3️⃣  Checking Cache Logs for Errors:"
echo "===================================="
sudo tail -30 /var/log/squid/cache.log | grep -i -E "error|denied|failed|warning"
echo ""

echo "4️⃣  Testing Proxy Authentication:"
echo "=================================="
echo "Testing with basic auth..."
echo -n "loadboard_proxy:DS!Pr0xy#2025\$Secur3" | base64
echo ""

echo "5️⃣  Checking Firewall Rules:"
echo "============================="
sudo ufw status | grep 3128
echo ""

echo "6️⃣  Testing Direct Connection:"
echo "==============================="
echo "Testing if we can reach httpbin directly..."
timeout 5 curl -s https://httpbin.org/ip && echo " ✅ Direct connection works" || echo " ❌ Direct connection failed"
echo ""

