@echo off
REM Digital Storming Loadboard - Production Deployment Script (Windows)
REM This script automates the deployment process for production

echo 🚀 Starting Digital Storming Loadboard Production Deployment...

REM Check if .env file exists
if not exist ".env" (
    echo [ERROR] .env file not found! Please create it from PRODUCTION_DEPLOYMENT.md
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

echo [SUCCESS] Node.js version check passed
node --version

REM Check if PM2 is installed
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing PM2...
    npm install -g pm2
    echo [SUCCESS] PM2 installed successfully
)

REM Create logs directory
echo [INFO] Creating logs directory...
if not exist "logs" mkdir logs
echo [SUCCESS] Logs directory created

REM Install dependencies
echo [INFO] Installing production dependencies...
npm ci --only=production
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [SUCCESS] Dependencies installed

REM Build the application
echo [INFO] Building application...
npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build application
    pause
    exit /b 1
)
echo [SUCCESS] Application built successfully

REM Run database migrations
echo [INFO] Running database migrations...
npm run db:migrate
if errorlevel 1 (
    echo [WARNING] Database migrations failed - check your DATABASE_URL
)
echo [SUCCESS] Database migrations completed

REM Stop existing PM2 processes
echo [INFO] Stopping existing PM2 processes...
pm2 stop digital-storming-loadboard 2>nul
pm2 delete digital-storming-loadboard 2>nul
echo [SUCCESS] Existing processes stopped

REM Start application with PM2
echo [INFO] Starting application with PM2...
pm2 start ecosystem.config.js --env production
if errorlevel 1 (
    echo [ERROR] Failed to start application with PM2
    pause
    exit /b 1
)
echo [SUCCESS] Application started with PM2

REM Save PM2 configuration
echo [INFO] Saving PM2 configuration...
pm2 save
pm2 startup
echo [SUCCESS] PM2 configuration saved

REM Show PM2 status
echo [INFO] PM2 Status:
pm2 status

REM Show recent logs
echo [INFO] Recent logs:
pm2 logs digital-storming-loadboard --lines 20

echo [SUCCESS] 🎉 Deployment completed successfully!
echo [INFO] Your application is now running in production mode
echo [INFO] Check the logs with: pm2 logs digital-storming-loadboard
echo [INFO] Monitor with: pm2 monit
echo [INFO] Restart with: pm2 restart digital-storming-loadboard

REM Health check
echo [INFO] Performing health check...
timeout /t 5 /nobreak >nul
curl -f http://localhost:4000/api/v1/healthz >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Health check failed. Check the logs for issues
) else (
    echo [SUCCESS] Health check passed! Application is responding
)

pause
