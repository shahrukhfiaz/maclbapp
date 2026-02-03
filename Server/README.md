# 🚀 Digital Storming Loadboard

A modern, enterprise-grade loadboard management system with shared DAT session capabilities, user management, and cloud deployment support.

## ✨ Features

- **🔐 Authentication & Authorization**: JWT-based auth with role-based access control
- **👥 User Management**: Complete CRUD operations with admin panel
- **🎯 Shared DAT Sessions**: Single session shared across all users
- **☁️ Cloud Ready**: Production deployment with PM2 and Nginx
- **📊 Admin Dashboard**: Modern UI with real-time statistics
- **🔒 Security**: Helmet, CORS, rate limiting, and input validation
- **📝 Audit Logging**: Complete audit trail for all actions
- **🌐 Object Storage**: AWS S3/DigitalOcean Spaces integration
- **🎨 Modern UI**: Dark theme with glassmorphism design

## 🏗️ Architecture

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Storage**: AWS S3/DigitalOcean Spaces
- **Process Management**: PM2 cluster mode
- **Frontend**: Vanilla JS with modern CSS
- **Browser Automation**: Playwright for DAT session management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- AWS S3 or DigitalOcean Spaces account
- PM2 (for production)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shahrukhfiaz/digital-storming-loadboard.git
   cd digital-storming-loadboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

5. **Development**
   ```bash
   npm run dev
   ```

6. **Production Deployment**
   ```bash
   # Linux/Mac
   ./deploy-production.sh
   
   # Windows
   deploy-production.bat
   ```

## 📋 Environment Variables

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for complete environment configuration.

### Required Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_ACCESS_SECRET`: JWT access token secret (32+ chars)
- `JWT_REFRESH_SECRET`: JWT refresh token secret (32+ chars)
- `OBJECT_STORAGE_ENDPOINT`: S3/Spaces endpoint
- `OBJECT_STORAGE_BUCKET`: Storage bucket name
- `OBJECT_STORAGE_ACCESS_KEY`: Storage access key
- `OBJECT_STORAGE_SECRET_KEY`: Storage secret key
- `SESSION_BUNDLE_ENCRYPTION_KEY`: 32-byte base64 encryption key

## 🎯 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### User Management
- `GET /api/v1/users` - List users (Admin)
- `POST /api/v1/users` - Create user (Admin)
- `PATCH /api/v1/users/:id/password` - Change password (Admin)
- `PATCH /api/v1/users/:id/status` - Update status (Admin)
- `PATCH /api/v1/users/:id/role` - Update role (Admin)
- `DELETE /api/v1/users/:id` - Delete user (Admin)

### Session Management
- `GET /api/v1/sessions/my-sessions` - Get user sessions
- `GET /api/v1/sessions/shared-stats` - Get session statistics
- `POST /api/v1/sessions/:id/mark-ready` - Mark session ready (Super Admin)

### Health Check
- `GET /api/v1/healthz` - Application health status

## 🎨 Admin Panel

Access the admin panel at `http://localhost:4000` after starting the server.

### Features
- **User Management**: Create, edit, delete users
- **Role Management**: Assign roles (USER, ADMIN, SUPER_ADMIN)
- **Status Management**: Enable/disable user accounts
- **Password Management**: Reset user passwords
- **Session Monitoring**: View shared session status
- **Real-time Statistics**: User counts and activity

### Default Credentials
- **Super Admin**: `superadmin@digitalstorming.com` / `ChangeMeSuperSecure123!`

## 🔧 Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/      # API route handlers
├── middleware/       # Express middleware
├── routes/          # API route definitions
├── services/        # Business logic
├── utils/           # Utility functions
├── jobs/            # Background workers
└── server.ts        # Main server file

public/              # Admin panel static files
prisma/              # Database schema and migrations
dist/                # Compiled JavaScript (production)
logs/                # Application logs
```

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run pm2:start` - Start with PM2
- `npm run pm2:logs` - View PM2 logs

## 🚀 Production Deployment

### DigitalOcean Droplet Setup

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - 2GB RAM minimum
   - Enable backups

2. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Install Nginx
   sudo apt install nginx -y
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/shahrukhfiaz/digital-storming-loadboard.git
   cd digital-storming-loadboard
   
   # Run deployment script
   ./deploy-production.sh
   ```

4. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/digital-storming-loadboard
   # Add configuration from PRODUCTION_DEPLOYMENT.md
   
   sudo ln -s /etc/nginx/sites-available/digital-storming-loadboard /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 📊 Monitoring

### PM2 Commands
```bash
pm2 status                    # View process status
pm2 logs digital-storming-loadboard  # View logs
pm2 monit                     # Monitor dashboard
pm2 restart digital-storming-loadboard  # Restart app
```

### Health Checks
- API: `curl http://your-domain.com/api/v1/healthz`
- Database: Check PM2 logs for connection status
- Storage: Test file upload/download

## 🔒 Security

### Production Security Checklist
- [ ] Generate new JWT secrets
- [ ] Use strong database credentials
- [ ] Enable SSL/TLS
- [ ] Configure firewall (UFW)
- [ ] Set up fail2ban
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity

### Firewall Setup
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` format
   - Verify database server is running
   - Check network connectivity

2. **Object Storage Errors**
   - Verify credentials and permissions
   - Check bucket exists and is accessible
   - Verify endpoint URL format

3. **JWT Token Errors**
   - Ensure secrets are properly set
   - Check token expiration settings
   - Verify token format

4. **PM2 Process Issues**
   - Check logs: `pm2 logs digital-storming-loadboard`
   - Restart process: `pm2 restart digital-storming-loadboard`
   - Check memory usage: `pm2 monit`

### Log Locations
- Application: `./logs/`
- PM2: `~/.pm2/logs/`
- Nginx: `/var/log/nginx/`

## 📝 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the production deployment guide

## 🎯 Roadmap

- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] Advanced monitoring (Prometheus/Grafana)
- [ ] API rate limiting per user
- [ ] Multi-tenant support
- [ ] Mobile app integration
- [ ] Advanced analytics dashboard
- [ ] Automated backups
- [ ] CI/CD pipeline

---

**Built with ❤️ for the Digital Storming team**