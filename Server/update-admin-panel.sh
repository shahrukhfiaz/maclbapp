#!/bin/bash

# Quick update script for cloud server admin panel fix
echo "Updating cloud server admin panel..."

# Navigate to the application directory
cd /root/digital-storming-loadboard

# Pull the latest changes
echo "Pulling latest changes from GitHub..."
git pull origin main

# Restart the application to load new admin panel
echo "Restarting application..."
pm2 restart digital-storming-loadboard

echo "✅ Admin panel updated! Try logging in again at http://157.230.51.160:3000/"
