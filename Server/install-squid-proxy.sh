#!/bin/bash

###############################################################################
# Squid Proxy Installation & Configuration Script
# Optimized for high-performance data handling with authentication
# Server: 67.205.189.32
###############################################################################

set -e  # Exit on error

echo "=========================================="
echo "  Squid Proxy Installation & Setup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Step 1: Install Squid and required packages
print_info "Step 1: Installing Squid proxy server..."
apt update -y
apt install -y squid apache2-utils

print_success "Squid installed: $(squid -v | head -n 1)"
echo ""

# Step 2: Backup original configuration
print_info "Step 2: Backing up original Squid configuration..."
if [ -f /etc/squid/squid.conf ]; then
    cp /etc/squid/squid.conf /etc/squid/squid.conf.backup.$(date +%Y%m%d_%H%M%S)
    print_success "Backup created"
fi
echo ""

# Step 3: Get proxy credentials from user
print_info "Step 3: Setting up proxy authentication..."
read -p "Enter proxy username: " PROXY_USER
read -sp "Enter proxy password: " PROXY_PASS
echo ""

if [ -z "$PROXY_USER" ] || [ -z "$PROXY_PASS" ]; then
    print_error "Username and password are required!"
    exit 1
fi

# Create password file
htpasswd -cb /etc/squid/passwords "$PROXY_USER" "$PROXY_PASS"
chmod 640 /etc/squid/passwords
chown proxy:proxy /etc/squid/passwords

print_success "Authentication configured for user: $PROXY_USER"
echo ""

# Step 4: Create optimized Squid configuration
print_info "Step 4: Creating optimized Squid configuration..."

cat > /etc/squid/squid.conf << 'EOF'
#
# Squid Proxy Configuration - Digital Storming Loadboard V2
# Optimized for high-performance data handling
# Generated: 2025-10-28
#

# ============================================================================
# PERFORMANCE TUNING - Optimized for Large Data Volumes
# ============================================================================

# Cache settings - Optimized for large files and high throughput
cache_mem 512 MB                          # Memory cache (increase if you have more RAM)
maximum_object_size_in_memory 512 KB      # Max object size in memory cache
maximum_object_size 1024 MB               # Max cacheable object (1GB for large files)
minimum_object_size 0 KB                  # Cache everything

# Cache directory - 10GB cache, 16 first-level dirs, 256 second-level dirs
# Syntax: cache_dir ufs Directory-Name Mbytes L1 L2
cache_dir ufs /var/spool/squid 10000 16 256

# Cache replacement policy (heap LFUDA is best for large files)
cache_replacement_policy heap LFUDA
memory_replacement_policy heap GDSF

# Increase file descriptors for high concurrency
max_filedesc 16384

# Worker processes (use CPU cores - 1, max 4 for stability)
workers 2

# Connection limits - High performance settings
http_port 3128

# Client connection limits
client_lifetime 1 day
pconn_timeout 60 seconds
read_timeout 15 minutes
request_timeout 5 minutes

# Server connection limits
forward_timeout 4 minutes
connect_timeout 1 minute
peer_connect_timeout 30 seconds

# Request body limits - Allow large uploads/downloads
request_body_max_size 0              # Unlimited (remove if you want to limit)
reply_body_max_size 0                # Unlimited

# ============================================================================
# BANDWIDTH OPTIMIZATION
# ============================================================================

# Quick abort settings - Don't abort large downloads
quick_abort_min 0 KB
quick_abort_max 0 KB
quick_abort_pct 100

# Range offset limit - Allow resume of large files
range_offset_limit 0

# Pipeline prefetching
pipeline_prefetch on

# ============================================================================
# MEMORY OPTIMIZATION
# ============================================================================

# Memory pools
memory_pools on
memory_pools_limit 64 MB

# ============================================================================
# DNS OPTIMIZATION
# ============================================================================

# DNS nameservers (use fast public DNS)
dns_nameservers 8.8.8.8 8.8.4.4 1.1.1.1

# DNS cache
positive_dns_ttl 6 hours
negative_dns_ttl 1 minute

# ============================================================================
# AUTHENTICATION - Basic Auth
# ============================================================================

# Authentication program
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwords
auth_param basic children 5 startup=5 idle=1
auth_param basic realm Digital Storming Loadboard Proxy
auth_param basic credentialsttl 2 hours
auth_param basic casesensitive on

# ============================================================================
# ACCESS CONTROL LISTS (ACLs)
# ============================================================================

# Define authenticated users
acl authenticated_users proxy_auth REQUIRED

# Safe ports
acl SSL_ports port 443
acl Safe_ports port 80          # http
acl Safe_ports port 21          # ftp
acl Safe_ports port 443         # https
acl Safe_ports port 70          # gopher
acl Safe_ports port 210         # wais
acl Safe_ports port 1025-65535  # unregistered ports
acl Safe_ports port 280         # http-mgmt
acl Safe_ports port 488         # gss-http
acl Safe_ports port 591         # filemaker
acl Safe_ports port 777         # multiling http

# SSL connect method
acl CONNECT method CONNECT

# Localhost
acl localhost src 127.0.0.1/32 ::1

# Local network (adjust if needed)
acl localnet src 10.0.0.0/8
acl localnet src 172.16.0.0/12
acl localnet src 192.168.0.0/16
acl localnet src fc00::/7
acl localnet src fe80::/10

# ============================================================================
# ACCESS RULES
# ============================================================================

# Deny requests to certain unsafe ports
http_access deny !Safe_ports

# Deny CONNECT to other than secure SSL ports
http_access deny CONNECT !SSL_ports

# Allow localhost without authentication
http_access allow localhost

# Require authentication for all other requests
http_access allow authenticated_users

# Deny all other access
http_access deny all

# ============================================================================
# NETWORK OPTIONS
# ============================================================================

# Listen on all interfaces
http_port 0.0.0.0:3128

# Forwarded-for header (for tracking)
forwarded_for on

# Via header (for tracking)
via on

# ============================================================================
# LOGGING - Optimized for performance
# ============================================================================

# Access log format (combined format with auth user)
logformat combined %>a %[ui %[un [%tl] "%rm %ru HTTP/%rv" %>Hs %<st "%{Referer}>h" "%{User-Agent}>h" %Ss:%Sh

# Access log
access_log daemon:/var/log/squid/access.log combined

# Cache log
cache_log /var/log/squid/cache.log

# Cache store log (disable for performance)
cache_store_log none

# Log rotation
logfile_rotate 10

# ============================================================================
# REFRESH PATTERNS - Cache freshness rules
# ============================================================================

# Don't cache dynamic content
refresh_pattern ^ftp:           1440    20%     10080
refresh_pattern ^gopher:        1440    0%      1440
refresh_pattern -i (/cgi-bin/|\?) 0     0%      0

# Cache static content aggressively
refresh_pattern -i \.(jpg|jpeg|png|gif|bmp|svg)$    10080   90%     43200 override-expire override-lastmod reload-into-ims
refresh_pattern -i \.(iso|avi|wav|mp3|mp4|mpeg|swf|flv|x-flv)$ 43200 90% 432000 override-expire override-lastmod reload-into-ims
refresh_pattern -i \.(deb|rpm|exe|zip|tar|tgz|ram|rar|bin|ppt|doc|tiff)$ 10080 90% 43200 override-expire override-lastmod reload-into-ims

# Default for everything else
refresh_pattern .               0       20%     4320

# ============================================================================
# SHUTDOWN TIMEOUT
# ============================================================================

shutdown_lifetime 3 seconds

# ============================================================================
# COREDUMP DIRECTORY
# ============================================================================

coredump_dir /var/spool/squid

# ============================================================================
# SECURITY
# ============================================================================

# Anonymize requests (optional - uncomment if you want to hide client info)
# request_header_access Allow allow all
# request_header_access Authorization allow all
# request_header_access WWW-Authenticate allow all
# request_header_access Proxy-Authorization allow all
# request_header_access Proxy-Authenticate allow all
# request_header_access Cache-Control allow all
# request_header_access Content-Encoding allow all
# request_header_access Content-Length allow all
# request_header_access Content-Type allow all
# request_header_access Date allow all
# request_header_access Expires allow all
# request_header_access Host allow all
# request_header_access If-Modified-Since allow all
# request_header_access Last-Modified allow all
# request_header_access Location allow all
# request_header_access Pragma allow all
# request_header_access Accept allow all
# request_header_access Accept-Charset allow all
# request_header_access Accept-Encoding allow all
# request_header_access Accept-Language allow all
# request_header_access Content-Language allow all
# request_header_access Mime-Version allow all
# request_header_access Retry-After allow all
# request_header_access Title allow all
# request_header_access Connection allow all
# request_header_access All deny all

# Prevent hostname disclosure
visible_hostname digital-storming-proxy

# HTTP version
http10 off

# ============================================================================
# END OF CONFIGURATION
# ============================================================================
EOF

print_success "Squid configuration created"
echo ""

# Step 5: Initialize cache directories
print_info "Step 5: Initializing Squid cache directories..."
squid -z
print_success "Cache directories initialized"
echo ""

# Step 6: Set proper permissions
print_info "Step 6: Setting permissions..."
chown -R proxy:proxy /var/spool/squid
chown -R proxy:proxy /var/log/squid
chmod -R 755 /var/spool/squid
print_success "Permissions set"
echo ""

# Step 7: Validate configuration
print_info "Step 7: Validating Squid configuration..."
if squid -k parse; then
    print_success "Configuration is valid"
else
    print_error "Configuration validation failed!"
    exit 1
fi
echo ""

# Step 8: Configure firewall
print_info "Step 8: Configuring firewall for Squid..."
ufw allow 3128/tcp comment 'Squid Proxy'
print_success "Firewall rule added for port 3128"
echo ""

# Step 9: Enable and start Squid
print_info "Step 9: Starting Squid service..."
systemctl enable squid
systemctl restart squid

# Wait for service to start
sleep 3

if systemctl is-active --quiet squid; then
    print_success "Squid is running"
else
    print_error "Squid failed to start"
    systemctl status squid
    exit 1
fi
echo ""

# Step 10: Test Squid
print_info "Step 10: Testing Squid proxy..."

# Test without auth (should fail)
if curl -x http://localhost:3128 http://httpbin.org/ip --max-time 10 2>&1 | grep -q "407"; then
    print_success "Authentication is working (407 response received)"
else
    print_error "Authentication test failed"
fi

# Test with auth
if curl -x http://${PROXY_USER}:${PROXY_PASS}@localhost:3128 http://httpbin.org/ip --max-time 10 &> /dev/null; then
    print_success "Authenticated access is working"
else
    print_error "Authenticated access test failed"
fi
echo ""

# Final status
echo ""
echo "=========================================="
echo "    SQUID PROXY SETUP COMPLETE!"
echo "=========================================="
echo ""
print_success "Squid Proxy Server: 67.205.189.32:3128"
print_success "Authentication: Enabled"
print_success "Username: $PROXY_USER"
print_success "Performance: Optimized for large data volumes"
echo ""
print_info "Configuration Details:"
echo "  - Cache Size: 10 GB"
echo "  - Memory Cache: 512 MB"
echo "  - Max Object Size: 1 GB"
echo "  - Max File Descriptors: 16384"
echo "  - Workers: 2"
echo "  - Authentication: Basic Auth (htpasswd)"
echo ""
print_info "Useful Commands:"
echo "  systemctl status squid      - Check Squid status"
echo "  systemctl restart squid     - Restart Squid"
echo "  tail -f /var/log/squid/access.log  - View access logs"
echo "  tail -f /var/log/squid/cache.log   - View cache logs"
echo "  squid -k reconfigure        - Reload configuration"
echo "  htpasswd /etc/squid/passwords <user>  - Add/update user"
echo ""
print_info "Test Proxy:"
echo "  curl -x http://${PROXY_USER}:${PROXY_PASS}@67.205.189.32:3128 http://httpbin.org/ip"
echo ""

# Save credentials to file for reference
cat > /root/squid-proxy-credentials.txt << CREDS
Squid Proxy Credentials - Digital Storming Loadboard V2
========================================================

Server: 67.205.189.32
Port: 3128
Username: ${PROXY_USER}
Password: ${PROXY_PASS}

Configuration File: /etc/squid/squid.conf
Password File: /etc/squid/passwords
Cache Directory: /var/spool/squid
Log Directory: /var/log/squid

Test Command:
curl -x http://${PROXY_USER}:${PROXY_PASS}@67.205.189.32:3128 http://httpbin.org/ip

IMPORTANT: Keep these credentials secure!
CREDS

chmod 600 /root/squid-proxy-credentials.txt
print_success "Credentials saved to: /root/squid-proxy-credentials.txt"
echo ""

