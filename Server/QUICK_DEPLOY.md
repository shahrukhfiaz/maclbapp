# 🚀 Quick Deployment Guide

## ✅ **Your Code is Now on GitHub!**

**Repository**: https://github.com/shahrukhfiaz/digital-storming-loadboard

## 🌐 **Deploy to DigitalOcean in 3 Steps**

### **Step 1: Create DigitalOcean Droplet**
1. Go to [digitalocean.com](https://digitalocean.com)
2. Create Ubuntu 22.04 droplet ($6/month)
3. Note your droplet IP (e.g., `157.245.123.456`)

### **Step 2: One-Command Deployment**
```bash
# Connect to your droplet
ssh root@YOUR_DROPLET_IP

# Deploy everything with one command
curl -fsSL https://raw.githubusercontent.com/shahrukhfiaz/digital-storming-loadboard/main/deploy-to-droplet.sh | bash -s YOUR_DROPLET_IP
```

### **Step 3: Update Client App**
```bash
# On your local machine
cd "Digital Storming Client"
cp CLOUD_CONFIG.env .env
# Edit .env file and replace YOUR_DROPLET_IP with your actual droplet IP
# Restart the client application
```

## 🎯 **What Happens During Deployment**

1. **System Setup**: Updates Ubuntu and installs Node.js, PM2
2. **Code Download**: Clones your repository from GitHub
3. **Configuration**: Sets up environment with your droplet IP
4. **Build & Start**: Builds the app and starts with PM2
5. **Testing**: Verifies the server is running correctly

## ✅ **Verification**

After deployment, test these URLs:
- **Health Check**: `http://YOUR_DROPLET_IP:4000/api/v1/healthz`
- **API Base**: `http://YOUR_DROPLET_IP:4000/api/v1`

## 🔧 **Client Configuration**

Update your client's `.env` file:
```bash
API_BASE_URL=https://YOUR_DROPLET_IP/api/v1
CLOUD_SERVER_IP=YOUR_DROPLET_IP
CLOUD_PROXY_ENABLED=true
```

## 🎉 **Result**

- ✅ **Global Access**: Users can connect from anywhere
- ✅ **IP Masking**: All browsing routes through your cloud server
- ✅ **Professional Setup**: Automated deployment and management
- ✅ **Cost**: Only $6/month for global proxy server

---

## 🆘 **Need Help?**

- **Check logs**: `pm2 logs loadboard-server`
- **Restart**: `pm2 restart loadboard-server`
- **Status**: `pm2 status`

**Your cloud server is ready for global access with IP masking!** 🌍🔒
