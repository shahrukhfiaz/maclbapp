# 🌐 Cloud Environment Setup Guide

## 📝 **Your Environment Variables (Cloud-Ready)**

Here's your corrected `.env` file for cloud deployment:

```bash
# Server Configuration (Cloud)
PORT=4000
NODE_ENV=production

# CORS - Allow connections from anywhere
CORS_ORIGIN=*

# Security
JWT_ACCESS_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
JWT_REFRESH_SECRET=f1e2d3c4b5a6789012345678901234567890fedcba1234567890fedcba123456
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12

# Database (Keep your existing Neon database)
DATABASE_URL=

# Cloud Server Configuration
CLOUD_SERVER_IP=YOUR_DROPLET_IP
CLOUD_SERVER_PORT=4000
CLOUD_PROXY_ENABLED=true

# API Base URL (Your cloud server)
API_BASE_URL=http://YOUR_DROPLET_IP:4000/api/v1

# Storage (Optional - for future use)
OBJECT_STORAGE_ENDPOINT=https://nyc3.digitaloceanspaces.com
OBJECT_STORAGE_BUCKET=ds-loadboard-sessions
OBJECT_STORAGE_ACCESS_KEY=your_key
OBJECT_STORAGE_SECRET_KEY=your_secret
OBJECT_STORAGE_REGION=nyc3

# Session seeder (Optional - for future use)
SEEDER_PLAYWRIGHT_WS_ENDPOINT=ws://localhost:9222
SEEDER_API_TOKEN=replace_with_machine_token
DAT_MASTER_USERNAME=
DAT_MASTER_PASSWORD=
SESSION_BUNDLE_ENCRYPTION_KEY=base64encoded32bytekey

# Proxy management (Optional)
DEFAULT_PROXY_ROTATION_INTERVAL_MINUTES=15
```

## 🔧 **Key Changes for Cloud:**

### **1. NODE_ENV**
```bash
# Change from:
NODE_ENV=development

# To:
NODE_ENV=production
```

### **2. Add CORS**
```bash
# Add this line:
CORS_ORIGIN=*
```

### **3. Cloud Server IP**
```bash
# Replace YOUR_DROPLET_IP with your actual droplet IP
CLOUD_SERVER_IP=157.245.123.456  # Your actual droplet IP
API_BASE_URL=http://157.245.123.456:4000/api/v1  # Your actual droplet IP
```

## 🚀 **Quick Setup:**

1. **Copy the cloud-ready config above**
2. **Replace `YOUR_DROPLET_IP` with your actual droplet IP**
3. **Save as `.env` file**
4. **Deploy to cloud**

## 📋 **Required vs Optional:**

### **✅ Required for Basic Function:**
- PORT, NODE_ENV, CORS_ORIGIN
- JWT secrets
- DATABASE_URL
- CLOUD_SERVER_IP, API_BASE_URL

### **🔧 Optional (for advanced features):**
- OBJECT_STORAGE_* (for session bundles)
- SEEDER_* (for automated session creation)
- PROXY_ROTATION (for proxy management)

## 🎯 **Minimal Working Config:**

If you want to start simple:

```bash
PORT=4000
NODE_ENV=production
CORS_ORIGIN=*
JWT_ACCESS_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
JWT_REFRESH_SECRET=f1e2d3c4b5a6789012345678901234567890fedcba1234567890fedcba123456
DATABASE_URL=postgresql://neondb_owner:npg_TABxjYCk9c4i@ep-autumn-art-adolj885-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
CLOUD_SERVER_IP=YOUR_DROPLET_IP
API_BASE_URL=http://YOUR_DROPLET_IP:4000/api/v1
```

**Just replace `YOUR_DROPLET_IP` with your actual droplet IP and you're ready to deploy!** 🚀
