#!/bin/bash

echo "🔧 Complete Squid HTTPS Fix..."
echo ""

# Backup current config
sudo cp /etc/squid/squid.conf /etc/squid/squid.conf.backup.$(date +%Y%m%d_%H%M%S)

# Create a new optimized Squid config that properly handles HTTPS
sudo tee /etc/squid/squid.conf > /dev/null <<'EOF'
# Squid Proxy Configuration - Digital Storming Loadboard V2
# Optimized for HTTPS traffic with authentication

# ============================================================================
# PERFORMANCE TUNING
# ============================================================================
cache_mem 512 MB
maximum_object_size_in_memory 512 KB
maximum_object_size 1024 MB
minimum_object_size 0 KB
cache_dir ufs /var/spool/squid 10000 16 256
cache_replacement_policy heap LFUDA
memory_replacement_policy heap GDSF
max_filedesc 16384

# ============================================================================
# NETWORK SETTINGS
# ============================================================================
http_port 3128

# Connection limits
client_lifetime 1 day
pconn_timeout 60 seconds
read_timeout 15 minutes
request_timeout 5 minutes
forward_timeout 4 minutes
connect_timeout 1 minute
peer_connect_timeout 30 seconds

# Allow large uploads/downloads
request_body_max_size 10 GB
reply_body_max_size 10 GB

# ============================================================================
# AUTHENTICATION
# ============================================================================
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwords
auth_param basic children 5 startup=5 idle=1
auth_param basic realm Digital Storming Loadboard Proxy
auth_param basic credentialsttl 2 hours
auth_param basic casesensitive on

# ============================================================================
# ACCESS CONTROL LISTS (ACLs)
# ============================================================================
acl authenticated_users proxy_auth REQUIRED

# SSL ports for HTTPS CONNECT
acl SSL_ports port 443
acl SSL_ports port 563   # NNTPS
acl SSL_ports port 873   # rsync

# Safe ports
acl Safe_ports port 80     # http
acl Safe_ports port 21     # ftp
acl Safe_ports port 443    # https
acl Safe_ports port 70     # gopher
acl Safe_ports port 210    # wais
acl Safe_ports port 1025-65535  # unregistered ports
acl Safe_ports port 280    # http-mgmt
acl Safe_ports port 488    # gss-http
acl Safe_ports port 591    # filemaker
acl Safe_ports port 777    # multiling http

# CONNECT method (used for HTTPS)
acl CONNECT method CONNECT

# Localhost
acl localhost src 127.0.0.1/32
acl localhost src ::1

# Local networks
acl localnet src 10.0.0.0/8
acl localnet src 172.16.0.0/12
acl localnet src 192.168.0.0/16
acl localnet src fc00::/7
acl localnet src fe80::/10

# ============================================================================
# ACCESS RULES (ORDER MATTERS!)
# ============================================================================
# Deny requests to unsafe ports
http_access deny !Safe_ports

# Deny CONNECT to non-SSL ports (security)
http_access deny CONNECT !SSL_ports

# Allow localhost management
http_access allow localhost

# *** CRITICAL: Allow HTTPS CONNECT for authenticated users ***
http_access allow CONNECT SSL_ports authenticated_users

# Allow authenticated users for regular HTTP
http_access allow authenticated_users

# Deny all other access
http_access deny all

# ============================================================================
# LOGGING
# ============================================================================
logformat combined %>a %[ui %[un [%tl] "%rm %ru HTTP/%rv" %>Hs %<st "%{Referer}>h" "%{User-Agent}>h" %Ss:%Sh
access_log daemon:/var/log/squid/access.log combined
cache_log /var/log/squid/cache.log
cache_store_log none
logfile_rotate 10

# ============================================================================
# DNS SETTINGS
# ============================================================================
dns_nameservers 8.8.8.8 8.8.4.4 1.1.1.1
positive_dns_ttl 6 hours
negative_dns_ttl 1 minute

# ============================================================================
# REFRESH PATTERNS
# ============================================================================
refresh_pattern ^ftp:           1440    20%     10080
refresh_pattern ^gopher:        1440    0%      1440
refresh_pattern -i (/cgi-bin/|\?) 0     0%      0
refresh_pattern .               0       20%     4320

# ============================================================================
# MISCELLANEOUS
# ============================================================================
coredump_dir /var/spool/squid
forwarded_for on
via on
EOF

echo "✅ New Squid configuration created"
echo ""

# Test the configuration
echo "🧪 Testing Squid configuration..."
sudo squid -k parse

if [ $? -ne 0 ]; then
    echo "❌ Configuration has errors! Restoring backup..."
    sudo cp /etc/squid/squid.conf.backup.* /etc/squid/squid.conf
    exit 1
fi

echo "✅ Configuration is valid"
echo ""

# Restart Squid
echo "🔄 Restarting Squid..."
sudo systemctl restart squid

# Wait for startup
sleep 3

# Check status
if sudo systemctl is-active --quiet squid; then
    echo "✅ Squid restarted successfully!"
else
    echo "❌ Squid failed to start!"
    echo "Check logs: sudo tail -50 /var/log/squid/cache.log"
    exit 1
fi

echo ""
echo "📊 Squid Status:"
sudo systemctl status squid --no-pager | head -15

echo ""
echo "🧪 Testing HTTPS proxy..."
sleep 2

# Test with proper password encoding
ENCODED_PASS="DS%21Pr0xy%232025%24Secur3"
echo "Testing: curl -x http://loadboard_proxy:PASSWORD@localhost:3128 https://httpbin.org/ip"

RESULT=$(curl -x "http://loadboard_proxy:${ENCODED_PASS}@localhost:3128" https://httpbin.org/ip -s -m 15)

if [ $? -eq 0 ]; then
    echo "✅ HTTPS proxy is working!"
    echo "Response: $RESULT"
else
    echo "❌ HTTPS proxy test failed"
    echo ""
    echo "📋 Recent access log:"
    sudo tail -10 /var/log/squid/access.log
    echo ""
    echo "📋 Recent cache log:"
    sudo tail -10 /var/log/squid/cache.log
fi

