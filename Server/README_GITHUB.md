# DAT Commercial - Digital Storming Loadboard Server

Backend server for Digital Storming Loadboard application with shared DAT session management, security features, and admin panel.

## 🚀 Features

- **Shared DAT Sessions**: Master session capture and distribution
- **User Management**: Role-based access control (SUPER_ADMIN, ADMIN, SUPPORT, USER)
- **Security Features**: 
  - Single active session enforcement
  - Login history tracking with geolocation
  - Device fingerprinting
  - Security alerts and monitoring
  - Force logout capabilities
- **Admin Panel**: Web-based management interface
- **Object Storage**: AWS S3 / DigitalOcean Spaces integration
- **High-Performance Proxy**: Squid proxy with authentication
- **PostgreSQL**: Prisma ORM with Neon database

## 📋 Prerequisites

- **Node.js**: 18.x or higher
- **PostgreSQL**: Database (recommended: Neon PostgreSQL)
- **PM2**: Process manager for production
- **DigitalOcean Spaces** or **AWS S3**: For session storage

## 🔧 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/shahrukhfiaz/dat-commercial.git
cd dat-commercial
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp env.example .env
# Edit .env with your credentials
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_ACCESS_SECRET`: Strong random string (32+ chars)
- `JWT_REFRESH_SECRET`: Strong random string (32+ chars)
- `OBJECT_STORAGE_*`: DigitalOcean Spaces or S3 credentials
- `PROXY_USERNAME`: Squid proxy username
- `PROXY_PASSWORD`: Squid proxy password

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### 5. Build Application

```bash
npm run build
```

### 6. Start Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run start:prod
# Or with PM2:
npm run pm2:start
```

## 🚀 Automated Deployment (Ubuntu/Debian)

For automated deployment to a DigitalOcean droplet or Ubuntu server:

```bash
chmod +x deploy-new-server.sh install-squid-proxy.sh
./deploy-new-server.sh
```

This script will:
- Install Node.js 18
- Install PM2
- Install and configure Squid proxy
- Setup database
- Build application
- Configure firewall
- Start services

## 📡 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/auth/session-status` - Validate session

### Users (Admin)
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PATCH /api/v1/users/:id/role` - Update role
- `DELETE /api/v1/users/:id` - Delete user

### DAT Sessions
- `GET /api/v1/sessions` - List sessions
- `POST /api/v1/sessions` - Create session
- `POST /api/v1/sessions/:id/mark-ready` - Mark session ready
- `DELETE /api/v1/sessions/:id` - Delete session

### Security (Admin)
- `GET /api/v1/login-history` - Login history
- `GET /api/v1/session-activity/active` - Active sessions
- `POST /api/v1/session-activity/:id/logout` - Force logout
- `GET /api/v1/security-alerts` - Security alerts

## 🎨 Admin Panel

Access the admin panel at `http://your-server-ip:3000`

Default credentials (change immediately after first login):
- Email: `superadmin@digitalstorming.com`
- Password: `ChangeMeSuperSecure123!`

### Admin Panel Features:
- **Users Management**: Create, edit, delete users
- **DAT Sessions**: Manage shared sessions
- **Login History**: Track all login attempts with IP/location
- **Active Sessions**: Monitor logged-in users, force logout
- **Security Alerts**: Real-time security notifications
- **Domains**: Manage proxy domains
- **Audit Logs**: Track privileged actions

## 🔒 Security Features

### Single Session Enforcement
- Only one active session per user
- Automatic logout when logging in from new device
- Real-time session validation

### Login History
- All login attempts recorded
- IP address and geolocation tracking
- Device fingerprinting (OS, browser, hardware)
- Success/failure tracking

### Security Alerts
- Multiple device login alerts
- Suspicious location detection
- Failed login attempt tracking
- Admin notifications

## 🗄️ Database Schema

Key models:
- **User**: User accounts with roles
- **DatSession**: Shared DAT sessions
- **LoginHistory**: Login attempt tracking
- **SessionActivity**: Active session monitoring
- **SecurityAlert**: Security event notifications
- **Domain**: Proxy domain management
- **AuditLog**: Privileged action logging

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run start        # Start production server
npm run db:migrate   # Run database migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
npm run pm2:start    # Start with PM2
npm run pm2:restart  # Restart PM2 service
npm run pm2:logs     # View PM2 logs
```

### Project Structure

```
Server/
├── src/
│   ├── config/          # Configuration (env, logger, storage)
│   ├── controllers/     # Route controllers
│   ├── db/              # Database client
│   ├── jobs/            # Background workers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   └── server.ts        # Entry point
├── prisma/
│   ├── migrations/      # Database migrations
│   └── schema.prisma    # Database schema
├── public/              # Admin panel static files
├── dist/                # Compiled output
└── ecosystem.config.js  # PM2 configuration
```

## 🔧 Configuration

### Squid Proxy

High-performance proxy configuration:
- Basic authentication required
- 512 MB memory cache
- 10 GB disk cache
- Optimized for large data transfers
- Port: 3128

### PM2 Configuration

Cluster mode with:
- Auto-restart on crash
- Memory limit: 1GB
- Multiple instances
- Log rotation

## 📊 Monitoring

### PM2 Monitoring

```bash
pm2 status                        # View status
pm2 logs digital-storming-loadboard  # View logs
pm2 monit                         # Live monitoring
```

### Health Check

```bash
curl http://localhost:3000/api/v1/healthz
```

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma db push
```

### PM2 Not Starting

```bash
# View detailed logs
pm2 logs digital-storming-loadboard --lines 100

# Restart service
pm2 restart digital-storming-loadboard
```

### Squid Proxy Issues

```bash
# Check status
systemctl status squid

# View logs
tail -f /var/log/squid/access.log

# Restart
systemctl restart squid
```

## 📄 License

Proprietary - Digital Storming

## 👥 Support

For support, contact: Digital Storming Team

---

## 🚀 Production Deployment Checklist

- [ ] Create DigitalOcean Spaces bucket
- [ ] Configure DATABASE_URL
- [ ] Generate strong JWT secrets
- [ ] Set Spaces credentials
- [ ] Configure proxy credentials
- [ ] Run deployment script
- [ ] Change super admin password
- [ ] Configure firewall
- [ ] Set up SSL/HTTPS
- [ ] Configure domain name
- [ ] Test all endpoints
- [ ] Verify security features

---

**Server:** Digital Storming Loadboard V2  
**Version:** 1.0.0  
**Status:** Production Ready ✅

