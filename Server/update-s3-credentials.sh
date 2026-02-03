#!/bin/bash

# Update S3 credentials on cloud server
echo "Updating DigitalOcean Spaces credentials..."

# Navigate to the application directory
cd /root/digital-storming-loadboard

# Backup current .env
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
echo "✅ Backed up current .env file"

# Update S3 credentials
sed -i 's|OBJECT_STORAGE_ACCESS_KEY=.*|OBJECT_STORAGE_ACCESS_KEY=DO00R3JYLUXTDG8ZRU9D|' .env
sed -i 's|OBJECT_STORAGE_SECRET_KEY=.*|OBJECT_STORAGE_SECRET_KEY=XC/WwnIYf9w0LxWFJ/i5aOO1D5oBNR3geS76teIQuJg|' .env

echo "✅ Updated S3 credentials in .env"

# Display updated credentials (masked for security)
echo ""
echo "Current S3 configuration:"
grep "OBJECT_STORAGE" .env | sed 's/\(SECRET_KEY=\).*/\1***MASKED***/'

echo ""
echo "Restarting application to apply changes..."
pm2 restart digital-storming-loadboard

echo ""
echo "✅ Done! Application restarted with new S3 credentials"
echo ""
echo "Next steps:"
echo "1. Login as super admin in the client app"
echo "2. Login to DAT"
echo "3. Session should now save successfully!"
echo "4. Check for message: '✅ Session saved and shared with all users!'"

