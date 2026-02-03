# Cloud Deployment Guide

## 🎯 **Goal**
Deploy the Digital Storming Loadboard server to the cloud so it's accessible from anywhere, and route all Chromium browsing through the cloud server's IP address.

## ☁️ **Recommended Cloud Platforms**

### **Option 1: DigitalOcean Droplet (Recommended)**
- **Cost**: ~$6-12/month
- **Setup**: Simple VPS with full control
- **IP**: Static public IP address
- **Perfect for**: Proxy/VPN-like setup

### **Option 2: AWS EC2**
- **Cost**: ~$10-20/month
- **Setup**: More complex but scalable
- **IP**: Elastic IP available
- **Perfect for**: Enterprise deployment

### **Option 3: Google Cloud Platform**
- **Cost**: ~$8-15/month
- **Setup**: Similar to AWS
- **IP**: Static external IP available
- **Perfect for**: Google ecosystem integration

### **Option 4: Railway/Render (Easiest)**
- **Cost**: ~$5-10/month
- **Setup**: One-click deployment
- **IP**: Shared IP (may not work for proxy)
- **Perfect for**: Quick testing

## 🚀 **Recommended: DigitalOcean Setup**

### **Step 1: Create DigitalOcean Droplet**

1. **Sign up** at [digitalocean.com](https://digitalocean.com)
2. **Create Droplet**:
   - **OS**: Ubuntu 22.04 LTS
   - **Size**: Basic ($6/month, 1GB RAM)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password
3. **Note the IP address** (e.g., `157.245.123.456`)

### **Step 2: Server Setup Commands**

```bash
# Connect to your droplet
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install PostgreSQL
apt install postgresql postgresql-contrib -y

# Install nginx (for reverse proxy)
apt install nginx -y

# Install Git
apt install git -y
```

### **Step 3: Deploy Your Application**

```bash
# Clone your repository (you'll need to push your code to GitHub first)
git clone https://github.com/yourusername/digital-storming-loadboard.git
cd digital-storming-loadboard

# Install dependencies
npm install

# Build the application
npm run build

# Set up environment variables
cp .env.example .env
nano .env  # Edit with your cloud database URL
```

### **Step 4: Environment Variables for Cloud**

```bash
# Database (use your existing Neon database)
DATABASE_URL=postgresql://neondb_owner:npg_TABxjYCk9c4i@ep-autumn-art-adolj885-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# Server settings
NODE_ENV=production
PORT=4000
JWT_SECRET=your-super-secret-jwt-key

# CORS settings (allow your client apps)
CORS_ORIGIN=*

# API Base URL (your cloud server)
API_BASE_URL=https://YOUR_DROPLET_IP:4000/api/v1

# Cloud server IP for proxy
CLOUD_SERVER_IP=YOUR_DROPLET_IP
CLOUD_SERVER_PORT=4000
```

### **Step 5: Start the Application**

```bash
# Start with PM2
pm2 start dist/server.js --name "loadboard-server"

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
```

### **Step 6: Configure Nginx (Reverse Proxy)**

```bash
# Create nginx config
nano /etc/nginx/sites-available/loadboard

# Add this configuration:
server {
    listen 80;
    server_name YOUR_DROPLET_IP;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable the site
ln -s /etc/nginx/sites-available/loadboard /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 🔧 **Next Steps After Deployment**

1. **Test the API**: `curl http://YOUR_DROPLET_IP/api/v1/healthz`
2. **Update client app**: Change `API_BASE_URL` to your cloud server
3. **Configure proxy**: Set up Chromium to use your cloud server as proxy
4. **Test IP masking**: Verify all browsing goes through your cloud IP

## 📋 **Checklist**

- [ ] DigitalOcean droplet created
- [ ] Server setup completed
- [ ] Application deployed and running
- [ ] Nginx configured
- [ ] API accessible from internet
- [ ] Client app updated to use cloud API
- [ ] Proxy configuration implemented
- [ ] IP masking tested

## 🎯 **Expected Result**

- **Loadboard server**: Accessible from anywhere via `http://YOUR_DROPLET_IP`
- **All Chromium browsing**: Routes through your cloud server's IP
- **User IPs hidden**: All external requests appear to come from your cloud server
- **Global access**: Users can connect from anywhere in the world

## 💰 **Cost Estimate**

- **DigitalOcean Droplet**: $6/month
- **Domain name (optional)**: $12/year
- **SSL certificate (optional)**: Free with Let's Encrypt
- **Total**: ~$7/month for global proxy server

---

**Ready to proceed with the deployment?** 🚀
