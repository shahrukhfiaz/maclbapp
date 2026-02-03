# Setting Up DigitalOcean Spaces for Session Storage

## Why You Need This

The super admin auto-save feature requires **object storage** (like AWS S3) to store and share session bundles with all users. Without this, session capture will fail.

## 🚀 Quick Setup (10 minutes)

### Step 1: Create a DigitalOcean Space

1. **Login to DigitalOcean**: https://cloud.digitalocean.com/
2. **Navigate to Spaces**: Click "Create" → "Spaces Object Storage"
3. **Choose Settings**:
   - **Datacenter**: Choose `NYC3` (or closest to your droplet)
   - **Enable CDN**: Optional (not required for this use case)
   - **Space Name**: `ds-loadboard-sessions` (or any name you prefer)
   - **Project**: Select your project
4. **Click "Create a Space"**
5. **Note the Endpoint**: Will be like `https://ds-loadboard-sessions.nyc3.digitaloceanspaces.com`

### Step 2: Generate API Keys

1. **Go to API section**: https://cloud.digitalocean.com/account/api/spaces
2. **Click "Generate New Key"**
3. **Give it a name**: e.g., "Loadboard Session Storage"
4. **Save the keys**:
   - **Access Key**: Looks like `DO00ABCDEFG123456789`
   - **Secret Key**: Looks like `abc123def456ghi789jkl012mno345pqr678stu901vwx234`
   - ⚠️ **IMPORTANT**: Save these immediately! The secret key is only shown once!

### Step 3: Update Backend .env File

**On your DigitalOcean droplet**, update the `.env` file:

```bash
# SSH into your server
ssh root@157.230.51.160

# Navigate to app directory
cd /root/digital-storming-loadboard

# Edit the .env file
nano .env
```

**Update these lines:**
```env
# Storage Configuration
OBJECT_STORAGE_ENDPOINT=https://nyc3.digitaloceanspaces.com
OBJECT_STORAGE_BUCKET=ds-loadboard-sessions
OBJECT_STORAGE_ACCESS_KEY=DO00ABCDEFG123456789  # Your actual access key
OBJECT_STORAGE_SECRET_KEY=abc123def456...        # Your actual secret key
OBJECT_STORAGE_REGION=nyc3
```

**Save and exit** (Ctrl+X, then Y, then Enter)

### Step 4: Restart the Backend

```bash
# Restart the application to load new credentials
pm2 restart digital-storming-loadboard

# Check if it's running
pm2 status

# Check logs for any errors
pm2 logs digital-storming-loadboard --lines 50
```

### Step 5: Test Session Capture

1. **Login as super admin** in the client app
2. **DAT will open** automatically
3. **Login to DAT** with your credentials
4. **Watch for status message**: Should say "✅ Session saved and shared with all users!"
5. **Check Space**: Go to DigitalOcean Spaces dashboard and verify a file was uploaded

## 🔍 Verification

### Check if S3 is Working

**On your server:**
```bash
# Test S3 connectivity (install aws-cli if needed)
curl -I https://ds-loadboard-sessions.nyc3.digitaloceanspaces.com
```

### Check Session Upload Logs

**On your server:**
```bash
pm2 logs digital-storming-loadboard | grep -i "session.*upload"
```

### Check Client Console

**In the client app:**
1. Press `Ctrl+Shift+I` to open DevTools
2. Look for these logs:
   - `📦 Capturing super admin session`
   - `✅ Session zipped`
   - `📤 Uploading session bundle`
   - `✅ Session uploaded successfully`
   - `🎉 Super admin session captured and uploaded successfully`

## 💰 Pricing

**DigitalOcean Spaces Pricing:**
- **$5/month** for 250 GB storage + 1 TB outbound transfer
- **Additional storage**: $0.02/GB
- **Additional transfer**: $0.01/GB

**For this use case:**
- Each session bundle: ~5-50 MB
- 100 session updates/month: ~1-5 GB storage
- **Cost**: $5/month (well within free tier)

## 🔐 Security Best Practices

1. **Restrict API Key Permissions**:
   - Only allow read/write to your specific Space
   - Don't use root account keys

2. **Enable Access Control**:
   - Keep Space private (not public)
   - Access controlled via presigned URLs

3. **Rotate Keys Regularly**:
   - Change API keys every 90 days
   - Update `.env` file after rotation

## 🛠️ Alternative: AWS S3

If you prefer AWS S3 instead of DigitalOcean Spaces:

```env
# AWS S3 Configuration
OBJECT_STORAGE_ENDPOINT=https://s3.amazonaws.com
OBJECT_STORAGE_BUCKET=your-bucket-name
OBJECT_STORAGE_ACCESS_KEY=AKIA...
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_REGION=us-east-1
```

**AWS S3 Setup:**
1. Create S3 bucket: https://s3.console.aws.amazon.com/
2. Create IAM user with S3 permissions
3. Generate access keys
4. Update `.env` file

## 🐛 Troubleshooting

### "Session capture failed"

**Possible causes:**
1. Invalid API keys → Check keys are correct
2. Wrong bucket name → Verify bucket exists
3. Network issues → Test connectivity to Spaces endpoint
4. Permissions → Ensure API key has read/write access

**Check logs:**
```bash
pm2 logs digital-storming-loadboard --err
```

### "Access Denied" errors

**Solution:**
- Regenerate API keys with full permissions
- Verify bucket name matches `.env` file
- Check Space is in the correct region

### Session not appearing for other users

**Solution:**
1. Verify upload succeeded (check Spaces dashboard)
2. Check `bundleKey` was updated in database
3. Ensure other users logout/login to get new session

## 📝 Summary

**What you need to do:**

1. ✅ **Create DigitalOcean Space** (5 minutes)
2. ✅ **Generate API keys** (2 minutes)
3. ✅ **Update `.env` file** on cloud server (2 minutes)
4. ✅ **Restart backend** with `pm2 restart` (1 minute)
5. ✅ **Test super admin login** and verify session capture works

**Total time: ~10 minutes**

**Cost: $5/month**

**Result: Super admin sessions automatically saved and shared with all users!** 🎉

