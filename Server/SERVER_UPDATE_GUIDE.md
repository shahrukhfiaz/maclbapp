# 🔄 Server Update Guide
# Digital Storming Loadboard - Updating Existing DigitalOcean Server

## 🚨 Important: Backup First!

Before updating, ensure you have backups of:
- Your current `.env` file (with all your production secrets)
- Your database (if you have important data)
- Any custom configurations

## 📋 Pre-Update Checklist

- [ ] Current server is accessible via SSH
- [ ] You have your production `.env` file backed up
- [ ] Database is backed up (if needed)
- [ ] You know your current server IP: `157.230.51.160`

## 🔄 Update Process

### Step 1: Connect to Your Server
```bash
ssh root@157.230.51.160
# or
ssh your-username@157.230.51.160
```

### Step 2: Stop Current Application
```bash
# Stop PM2 processes
pm2 stop all
pm2 delete all

# Or if running without PM2
pkill -f "node.*server"
```

### Step 3: Backup Current Configuration
```bash
# Create backup directory
mkdir -p ~/backup-$(date +%Y%m%d)

# Backup your current .env file
cp .env ~/backup-$(date +%Y%m%d)/env.backup

# Backup any custom configurations
cp -r ~/digital-storming-loadboard ~/backup-$(date +%Y%m%d)/app-backup
```

### Step 4: Update Application Code
```bash
# Navigate to your app directory
cd ~/digital-storming-loadboard

# Pull latest changes from GitHub
git fetch origin
git reset --hard origin/main

# Or if you want to be extra safe, clone fresh
cd ~
rm -rf digital-storming-loadboard-old
mv digital-storming-loadboard digital-storming-loadboard-old
git clone https://github.com/shahrukhfiaz/digital-storming-loadboard.git
cd digital-storming-loadboard
```

### Step 5: Restore Your Environment Configuration
```bash
# Copy your backed up .env file
cp ~/backup-$(date +%Y%m%d)/env.backup .env

# Verify your .env file has all required variables
cat .env
```

### Step 6: Install Dependencies and Build
```bash
# Install dependencies
npm ci --only=production

# Build the application
npm run build

# Generate Prisma client
npm run db:generate
```

### Step 7: Database Migration (if needed)
```bash
# Run any new database migrations
npm run db:migrate
```

### Step 8: Start with New PM2 Configuration
```bash
# Start with the new ecosystem configuration
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Check status
pm2 status
pm2 logs digital-storming-loadboard --lines 20
```

### Step 9: Test the Application
```bash
# Test health endpoint
curl http://localhost:4000/api/v1/healthz

# Test admin panel
curl http://localhost:4000
```

### Step 10: Update Nginx (if needed)
```bash
# Check if Nginx needs updates
sudo nginx -t

# If you have custom Nginx config, update it
sudo nano /etc/nginx/sites-available/digital-storming-loadboard

# Reload Nginx
sudo systemctl reload nginx
```

## 🔧 Troubleshooting Common Issues

### Issue 1: Port Already in Use
```bash
# Check what's using port 4000
sudo lsof -i :4000

# Kill the process
sudo kill -9 <PID>

# Restart PM2
pm2 restart digital-storming-loadboard
```

### Issue 2: Database Connection Failed
```bash
# Check your DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test database connection
npm run db:migrate
```

### Issue 3: Missing Environment Variables
```bash
# Check for missing variables
node -e "require('dotenv').config(); console.log('JWT_ACCESS_SECRET:', process.env.JWT_ACCESS_SECRET ? 'SET' : 'MISSING')"

# Add missing variables to .env
nano .env
```

### Issue 4: Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🎯 Post-Update Verification

### 1. Check Application Status
```bash
pm2 status
pm2 logs digital-storming-loadboard --lines 50
```

### 2. Test API Endpoints
```bash
# Health check
curl http://localhost:4000/api/v1/healthz

# Test login (replace with your credentials)
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@digitalstorming.com","password":"ChangeMeSuperSecure123!"}'
```

### 3. Test Admin Panel
- Open browser: `http://157.230.51.160`
- Login with super admin credentials
- Verify all features work (user management, etc.)

### 4. Monitor Performance
```bash
# Monitor PM2
pm2 monit

# Check system resources
htop
df -h
```

## 🚀 New Features Available

After update, you'll have access to:
- ✅ Modern dark theme admin panel
- ✅ Notification system with dismissible balloons
- ✅ Enhanced user management interface
- ✅ Improved button positioning and styling
- ✅ Better error handling and logging
- ✅ Production-ready PM2 configuration
- ✅ Comprehensive monitoring tools

## 📞 Rollback Plan (if needed)

If something goes wrong:
```bash
# Stop current app
pm2 stop digital-storming-loadboard
pm2 delete digital-storming-loadboard

# Restore old version
cd ~
rm -rf digital-storming-loadboard
mv digital-storming-loadboard-old digital-storming-loadboard
cd digital-storming-loadboard

# Restore old .env
cp ~/backup-$(date +%Y%m%d)/env.backup .env

# Start old version
pm2 start ecosystem.config.js --env production
```

## 🎉 Success!

Once everything is working:
- Your server is updated with the latest features
- All your data and configurations are preserved
- The new admin panel is available
- Performance should be improved with PM2 cluster mode

Monitor the logs for the first few hours to ensure everything is running smoothly!
