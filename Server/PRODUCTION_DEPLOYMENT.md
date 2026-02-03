# Production Deployment Guide
# Digital Storming Loadboard - Cloud Deployment

## 🚀 Quick Production Setup

### 1. Environment Variables
Create a `.env` file with the following production configuration:

```bash
# Server Configuration
PORT=4000
NODE_ENV=production

# Security (Generate new secrets for production!)
JWT_ACCESS_SECRET=your_production_jwt_access_secret_here_minimum_32_characters
JWT_REFRESH_SECRET=your_production_jwt_refresh_secret_here_minimum_32_characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12

# Database (Replace with your production database URL)
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Object Storage (DigitalOcean Spaces or AWS S3)
OBJECT_STORAGE_ENDPOINT=https://nyc3.digitaloceanspaces.com
OBJECT_STORAGE_BUCKET=your-production-bucket-name
OBJECT_STORAGE_ACCESS_KEY=your_access_key_here
OBJECT_STORAGE_SECRET_KEY=your_secret_key_here
OBJECT_STORAGE_REGION=nyc3

# Session Bundle Encryption (Generate a secure 32-byte base64 key)
SESSION_BUNDLE_ENCRYPTION_KEY=your_32_byte_base64_encryption_key_here

# DAT Master Credentials (For session seeding)
DAT_MASTER_USERNAME=your_dat_username@domain.com
DAT_MASTER_PASSWORD=your_dat_password_here

# API Configuration
API_BASE_URL=https://your-domain.com/api/v1
SEEDER_API_TOKEN=your_machine_token_for_seeder_worker

# Playwright Configuration
SEEDER_PLAYWRIGHT_WS_ENDPOINT=ws://localhost:9222

# Proxy Configuration (Optional - for IP masking)
CLOUD_PROXY_ENABLED=false
CLOUD_SERVER_IP=your_server_ip
CLOUD_PROXY_PORT=8080

# CORS Configuration
CORS_ORIGIN=https://your-domain.com,https://your-client-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### 2. Security Checklist
- [ ] Generate new JWT secrets (minimum 32 characters)
- [ ] Use strong database credentials
- [ ] Secure object storage access keys
- [ ] Generate new session bundle encryption key
- [ ] Update DAT master credentials
- [ ] Configure CORS for your domains only
- [ ] Enable rate limiting
- [ ] Set up SSL/TLS certificates

### 3. Database Setup
```bash
# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 4. Build and Start
```bash
# Install dependencies
npm ci --only=production

# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
```

### 5. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy to Node.js app
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
```

### 6. PM2 Ecosystem Configuration
Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'digital-storming-loadboard',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### 7. Monitoring and Logs
```bash
# View PM2 logs
pm2 logs digital-storming-loadboard

# Monitor PM2 processes
pm2 monit

# Restart application
pm2 restart digital-storming-loadboard

# Save PM2 configuration
pm2 save
pm2 startup
```

### 8. Health Checks
- API Health: `GET /api/v1/healthz`
- Database: Check connection in logs
- Object Storage: Test upload/download functionality
- Authentication: Test login endpoints

### 9. Backup Strategy
- Database backups (daily)
- Object storage backups
- Environment variable backups
- SSL certificate backups

### 10. Security Considerations
- Regular security updates
- Monitor failed login attempts
- Log analysis for suspicious activity
- SSL certificate renewal
- Access key rotation

## 🔧 Troubleshooting

### Common Issues:
1. **Database Connection**: Check DATABASE_URL format
2. **Object Storage**: Verify credentials and bucket permissions
3. **JWT Errors**: Ensure secrets are properly set
4. **CORS Issues**: Update CORS_ORIGIN with correct domains
5. **Memory Issues**: Monitor with PM2 and adjust max_memory_restart

### Log Locations:
- Application logs: `./logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`

## 📞 Support
For production support, ensure you have:
- Monitoring setup (PM2, Nginx, Database)
- Log aggregation
- Error tracking
- Performance monitoring
- Backup verification
