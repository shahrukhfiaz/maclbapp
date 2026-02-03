# S3 Credentials Update Guide

## ✅ Your DigitalOcean Spaces Credentials

You've successfully created DigitalOcean Spaces with the following details:

- **Space Name**: `ds-loadboard-sessions`
- **Endpoint**: `https://ds-loadboard-sessions.nyc3.digitaloceanspaces.com`
- **Region**: `nyc3`
- **Access Key**: `DO00R3JYLUXTDG8ZRU9D`
- **Secret Key**: `XC/WwnIYf9w0LxWFJ/i5aOO1D5oBNR3geS76teIQuJg`

## 🚀 Update Your Cloud Server

### Option 1: Automated Script (Recommended)

SSH into your server and run:

```bash
# SSH into your droplet
ssh root@157.230.51.160

# Navigate to app directory
cd /root/digital-storming-loadboard

# Download the update script
wget https://raw.githubusercontent.com/shahrukhfiaz/digital-storming-loadboard/main/update-s3-credentials.sh

# Make it executable
chmod +x update-s3-credentials.sh

# Run the script
./update-s3-credentials.sh
```

### Option 2: Manual Update

SSH into your server and edit the `.env` file:

```bash
# SSH into your droplet
ssh root@157.230.51.160

# Navigate to app directory
cd /root/digital-storming-loadboard

# Backup current .env
cp .env .env.backup

# Edit the .env file
nano .env
```

**Update these lines in the `.env` file:**

```env
# Storage Configuration
OBJECT_STORAGE_ENDPOINT=https://nyc3.digitaloceanspaces.com
OBJECT_STORAGE_BUCKET=ds-loadboard-sessions
OBJECT_STORAGE_ACCESS_KEY=DO00R3JYLUXTDG8ZRU9D
OBJECT_STORAGE_SECRET_KEY=XC/WwnIYf9w0LxWFJ/i5aOO1D5oBNR3geS76teIQuJg
OBJECT_STORAGE_REGION=nyc3
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter`

**Restart the application:**

```bash
pm2 restart digital-storming-loadboard

# Check if it's running
pm2 status

# Check logs for any errors
pm2 logs digital-storming-loadboard --lines 20
```

## ✅ Verification

### 1. Check Server Logs

After restarting, check for any S3-related errors:

```bash
pm2 logs digital-storming-loadboard --err
```

You should NOT see any S3 authentication errors.

### 2. Test Super Admin Session Capture

1. **Login as super admin** in your client app
2. **DAT will open** automatically
3. **Login to DAT** with your credentials
4. **Watch for status messages**:
   - "Saving session for all users..."
   - "✅ Session saved and shared with all users!"

### 3. Check DigitalOcean Spaces

1. Go to: https://cloud.digitalocean.com/spaces
2. Click on `ds-loadboard-sessions`
3. Look for a `sessions/` folder
4. You should see uploaded zip files after super admin logs in

### 4. Test Regular User

1. **Logout from super admin**
2. **Login as regular user**
3. **DAT should open with super admin's session** (already logged in!)

## 🎯 Expected Behavior

### Super Admin Flow:
1. Login to client → DAT opens → Login to DAT
2. System captures session after 3 seconds
3. Creates zip file of session data
4. Uploads to DigitalOcean Spaces
5. Shows: "✅ Session saved and shared with all users!"

### Regular User Flow:
1. Login to client
2. System downloads latest session from Spaces
3. DAT opens with super admin's session
4. User is already logged into DAT automatically

## 🐛 Troubleshooting

### Error: "Access Denied" or "Invalid credentials"

**Solution:**
1. Double-check Access Key and Secret Key are correct
2. Verify no extra spaces or characters
3. Regenerate keys if needed

### Error: "Bucket not found"

**Solution:**
1. Verify Space name is exactly `ds-loadboard-sessions`
2. Check Space is in `nyc3` region
3. Make sure Space was created successfully

### Session still not capturing

**Check client console logs:**
1. Open client app
2. Press `Ctrl+Shift+I` for DevTools
3. Look for error messages in Console tab

**Check server logs:**
```bash
pm2 logs digital-storming-loadboard | grep -i "session"
```

## 🔒 Security Notes

### Keep These Credentials Secret!

- ✅ These credentials are stored in `.env` file on server (not in Git)
- ✅ Never commit `.env` file to version control
- ✅ Rotate keys every 90 days for security
- ✅ Only share with trusted system administrators

### Key Permissions

Your Spaces key has full read/write access to the `ds-loadboard-sessions` Space:
- Can upload session bundles
- Can download session bundles
- Can delete old bundles (if needed)

## 💰 Billing

**DigitalOcean Spaces Pricing:**
- **$5/month** for 250 GB storage + 1 TB transfer
- Your usage: ~1-5 GB/month (session bundles)
- **Well within the included limits**

## 📋 Summary

**What you need to do now:**

1. ✅ **SSH into your cloud server**
2. ✅ **Run the update script OR manually edit `.env`**
3. ✅ **Restart the application** with `pm2 restart`
4. ✅ **Test super admin login** and verify session saves
5. ✅ **Test regular user login** and verify they get super admin's session

**After this, your super admin auto-save system will be fully functional!** 🎉

## 📞 Next Steps

After updating the credentials:

1. Test super admin login and DAT session capture
2. Verify session appears in DigitalOcean Spaces
3. Test regular user getting the shared session
4. Confirm IP masking works with Squid proxy

Everything should work smoothly now! 🚀

