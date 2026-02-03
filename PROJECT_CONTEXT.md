# DAT Loadboard - Complete Project Context

**Last Updated:** 2025-02-03  
**Project Version:** 1.0.0  
**Project Type:** Electron Desktop Application + Node.js/Express Backend Server

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Directory Structure](#directory-structure)
4. [Core Components](#core-components)
5. [Configuration Files](#configuration-files)
6. [Build System](#build-system)
7. [Icon System](#icon-system)
8. [Session Management](#session-management)
9. [Authentication & Security](#authentication--security)
10. [Proxy Configuration](#proxy-configuration)
11. [Database Schema](#database-schema)
12. [API Endpoints](#api-endpoints)
13. [Deployment](#deployment)
14. [Development Workflow](#development-workflow)
15. [Key Features](#key-features)
16. [Known Issues & Solutions](#known-issues--solutions)

---

## 🎯 Project Overview

**DAT Loadboard** is an Electron-based desktop application that provides authenticated access to DAT (Freight & Analytics) web sessions. The application acts as a secure wrapper around Chromium, allowing users to access pre-configured DAT sessions without manual login.

### Main Purpose
- Provide branded login interface for DAT access
- Manage and share DAT sessions across multiple users
- Route traffic through cloud proxy for IP masking
- Maintain session state across app restarts
- Support multiple tabs/windows with Chrome-like interface

### Key Technologies
- **Frontend**: Electron 39.0.0, Chromium (via Electron)
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Storage**: DigitalOcean Spaces (S3-compatible)
- **Build**: electron-builder, NSIS installer
- **Process Management**: PM2 (server)

---

## 🏗️ Architecture

### Client-Server Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Client                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Login Window │  │  DAT Window  │  │  Tab Manager │ │
│  │  (Browser)   │  │ (BrowserView)│  │  (Browser)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │         Main Process (Node.js)                    │ │
│  │  - Authentication                                │ │
│  │  - Session Download/Upload                       │ │
│  │  - Tab Management                                │ │
│  │  - Proxy Configuration                          │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTPS/REST API
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Express Backend Server                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Auth API   │  │ Session API  │  │  User API    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │         Services Layer                           │ │
│  │  - Authentication Service                       │ │
│  │  - Session Bundle Service                       │ │
│  │  - User Management Service                      │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │ DO Spaces    │ │   PM2        │
│  (Neon DB)   │ │  (S3 Storage)│ │  (Process)   │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Data Flow

1. **User Login**: Client → Backend API → JWT Token → Client stores token
2. **Session Download**: Client requests session → Backend generates signed URL → Client downloads from Spaces → Extracts to local partition
3. **Session Upload**: Client zips session → Backend generates upload URL → Client uploads to Spaces → Backend updates database
4. **Tab Management**: Main process creates BrowserViews → Tab Manager coordinates → IPC communication with renderer

---

## 📁 Directory Structure

```
DAT APP/
├── src/                          # Main application source
│   ├── main/                     # Main process (Node.js)
│   │   ├── main.js              # Main entry point (3505 lines)
│   │   ├── proxyConfig.js       # Proxy configuration
│   │   └── tabManager.js        # Chrome-like tab system
│   ├── preload/                  # Preload scripts (context bridge)
│   │   ├── index.js             # Login window preload
│   │   ├── sessionPreload.js    # DAT window preload
│   │   └── tabBarPreload.js     # Tab bar preload
│   └── renderer/                 # Renderer process (empty - uses public/)
│
├── public/                       # Static assets and UI
│   ├── index.html               # Login page
│   ├── tab-bar.html             # Tab bar UI (hardcoded in window)
│   ├── renderer.js              # Login page logic
│   ├── styles.css               # Login page styles
│   ├── access-denied.html       # Access denied page
│   └── assets/                  # Images, icons
│       ├── icon.ico             # Application icon
│       ├── icon.png             # Application icon (PNG)
│       ├── icon-16x16.png       # Small icon
│       ├── icon-32x32.png       # Standard icon
│       ├── icon-48x48.png       # Medium icon
│       ├── icon-256x256.png     # Large icon
│       └── dat-logo-email.svg   # DAT logo
│
├── build/                        # Build assets
│   ├── icon.ico                 # Generated Windows icon
│   ├── installer.nsh            # NSIS installer script
│   ├── LICENSE.txt              # License file
│   ├── logo.bmp                 # Installer logo
│   └── welcome.bmp              # Installer welcome image
│
├── scripts/                      # Build and utility scripts
│   ├── after-pack.js            # Post-build hook (icon embedding)
│   ├── after-all-artifacts.js   # Post-artifact hook
│   ├── embed-icon.js            # Icon embedding script
│   ├── create-windows-icon.js   # ICO file generator
│   ├── fix-shortcut-icon.bat    # Windows shortcut fix
│   └── fix-shortcut-icon.ps1    # PowerShell shortcut fix
│
├── Server/                       # Backend server (separate project)
│   ├── src/                     # TypeScript source
│   │   ├── config/              # Configuration
│   │   ├── controllers/         # API controllers
│   │   ├── services/            # Business logic
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Express middleware
│   │   ├── db/                  # Database client
│   │   └── server.ts            # Server entry point
│   ├── prisma/                  # Database schema
│   │   ├── schema.prisma        # Prisma schema
│   │   └── migrations/          # Database migrations
│   ├── public/                  # Admin panel static files
│   └── dist/                    # Compiled JavaScript
│
├── release-icon-embed/          # Build output directory
│   └── DAT Loadboard-1.0.0-Setup.exe
│
├── session-capture-app/         # Standalone session capture app
├── session-capture-optimized/   # Optimized session capture
│
├── package.json                 # Main package.json
├── .env                         # Environment variables (not in repo)
├── client-production.env        # Production env template
├── session-config.env           # Session capture config
│
└── Documentation files:
    ├── README.md
    ├── SETUP.md
    ├── DEPLOYMENT_INSTRUCTIONS.md
    ├── ICON_FIX_GUIDE.md
    ├── ICON_REQUIREMENTS.md
    └── [Many other .md files]
```

---

## 🔧 Core Components

### 1. Main Process (`src/main/main.js`)

**Size**: 3505 lines  
**Purpose**: Core application logic, window management, session handling

**Key Functions**:
- `createLoginWindow()` - Creates login window
- `launchDatWindow()` - Creates DAT window with tab bar
- `launchSession()` - Downloads and launches session
- `launchFreshDatSession()` - Launches fresh DAT (super admin only)
- `downloadSessionBundle()` - Downloads session from cloud
- `uploadSessionFromDirectory()` - Uploads session to cloud
- `captureSuperAdminSession()` - Captures super admin session
- `resolveAppIcon()` - Resolves icon path (multiple fallbacks)
- `setWindowIcon()` - Sets window icon explicitly
- `validateSessionCompleteness()` - Validates session files

**Key Variables**:
- `loginWindow` - Login window instance
- `datWindow` - DAT window instance
- `tabManager` - Tab manager instance
- `tokens` - JWT tokens (access + refresh)
- `currentUser` - Current logged-in user
- `currentSessionId` - Current session ID
- `isIntentionalLogout` - Flag to prevent app.quit on logout

**IPC Handlers**:
- `auth:login` - User login
- `auth:logout` - User logout
- `session:launch` - Launch session
- `session:validate` - Validate session
- `test:ip` - Test IP address
- `dat:new-window` - Create new tab
- `tab:switch` - Switch tab
- `tab:close` - Close tab
- `tab:update-title` - Update tab title
- `tab:get-all` - Get all tabs
- `window:minimize` - Minimize window
- `window:maximize` - Maximize window
- `window:close` - Close window

### 2. Tab Manager (`src/main/tabManager.js`)

**Purpose**: Manages Chrome-like tabs using BrowserView

**Key Features**:
- Creates tabs as BrowserView instances
- Manages tab switching, closing, title updates
- Enforces security (blocks DAT login page for non-super-admin)
- Maintains tab state (loading, ready, title)
- Updates tab bar UI via IPC
- Handles window resize

**Key Methods**:
- `createTab(sessionInfo, datUrl, isLoading)` - Create new tab
- `switchToTab(tabId)` - Switch to tab
- `closeTab(tabId)` - Close tab
- `updateTabTitle(tabId, newTitle)` - Update tab title
- `updateTabBounds(tabId)` - Update tab position/size
- `updateTabBar()` - Send tab data to UI
- `destroy()` - Cleanup all tabs

**Security Features**:
- Blocks DAT login page (`login.dat.com`) for non-super-admin users
- Redirects to access-denied.html
- Checks URL on multiple navigation events

### 3. Proxy Configuration (`src/main/proxyConfig.js`)

**Purpose**: Configures proxy for cloud IP masking

**Key Functions**:
- `configureCloudProxy(cloudServerIP, proxyPort)` - Configure proxy
- `initializeProxy()` - Initialize from environment
- `createProxiedSession()` - Create session with proxy
- `testProxyConnection()` - Test proxy connectivity

**Environment Variables**:
- `CLOUD_PROXY_ENABLED` - Enable/disable proxy
- `CLOUD_SERVER_IP` - Proxy server IP (default: 167.99.147.118)
- `CLOUD_PROXY_PORT` - Proxy port (default: 3128 for Squid)
- `PROXY_USERNAME` / `PROXY_PASSWORD` - Proxy auth credentials

### 4. Preload Scripts

**`src/preload/index.js`** - Login window context bridge
- Exposes: `window.dslb.login()`, `window.dslb.launchSession()`, `window.dslb.logout()`, `window.dslb.testIP()`, `window.dslb.validateSession()`, `window.dslb.onStatus()`

**`src/preload/sessionPreload.js`** - DAT window context bridge
- Exposes: `window.dslbSession.logout()`, `window.dslbSession.newWindow()`, `window.dslbSession.switchTab()`, `window.dslbSession.closeTab()`, `window.dslbSession.updateTabTitle()`, `window.dslbSession.getAllTabs()`, window controls

**`src/preload/tabBarPreload.js`** - Tab bar context bridge
- Exposes: Same as sessionPreload + `window.dslbSession.onTabsUpdate()`

### 5. Renderer Scripts

**`public/renderer.js`** - Login page logic
- Handles login form submission
- Manages session list display
- Shows download progress
- Validates session periodically
- Handles logout from another device

**Key Features**:
- Two-step login (email → password)
- Progress bar on login button
- Session validation every 5 seconds
- Auto-logout on session invalidation
- Download progress display

### 6. Backend Server (`Server/`)

**Technology Stack**:
- Express.js (TypeScript)
- Prisma ORM
- PostgreSQL (Neon)
- DigitalOcean Spaces (S3-compatible)
- JWT authentication
- PM2 process management
- Zod for schema validation
- Pino for logging
- Helmet for security
- CORS for cross-origin requests

**Server Entry Point** (`Server/src/server.ts`):
- Configures middleware (helmet, cors, express.json, morgan)
- Serves static files (admin panel)
- Mounts API routes
- Health check endpoint
- Database connection
- Super admin bootstrap on startup

**Middleware**:
- `auth.ts` - JWT authentication, single session enforcement
- `errorHandler.ts` - Global error handling
- `asyncHandler.ts` - Async route wrapper

**Utilities**:
- `token.ts` - JWT signing and verification
- `password.ts` - Bcrypt hashing and comparison
- `deviceFingerprint.ts` - Device info parsing and fingerprinting
- `geolocation.ts` - IP geolocation (ip-api.com), distance calculation, suspicious location detection
- `appError.ts` - Custom error class for operational errors

**Key Services**:
- `auth.service.ts` - Authentication & JWT, single session enforcement, billing status checks
- `session.service.ts` - Session CRUD operations
- `sessionBundle.service.ts` - Bundle upload/download, presigned URLs
- `sharedSession.service.ts` - Shared session logic (all users share one session)
- `sessionAssignment.service.ts` - Session assignment to users
- `user.service.ts` - User management (CRUD)
- `audit.service.ts` - Audit logging for all actions
- `domain.service.ts` - Domain management (DAT domains)
- `loginHistory.service.ts` - Login attempt tracking with geolocation
- `securityAlert.service.ts` - Security alerts (multiple device login, suspicious location, etc.)
- `sessionActivity.service.ts` - Active session tracking and monitoring
- `billing.service.ts` - Billing cycle management, payment tracking, trial periods, auto-disable expired accounts

**Key Controllers**:
- `auth.controller.ts` - Login, refresh, session status, user details (me)
- `session.controller.ts` - Session CRUD, mark-ready, bundle operations
- `user.controller.ts` - User CRUD (admin), password change, status toggle, role update
- `sessionActivity.controller.ts` - Active sessions, force logout, session history
- `loginHistory.controller.ts` - Login history retrieval (user and admin)
- `securityAlert.controller.ts` - Security alerts management (read, dismiss, stats)
- `audit.controller.ts` - Audit log listing (admin)
- `domain.controller.ts` - Domain CRUD (admin)
- `billing.controller.ts` - Billing operations (start cycle, add payment, set trial, get status, history, expired accounts)

**Background Jobs**:
- `sessionSeeder.worker.ts` - Playwright-based automated DAT session seeding
  - Uses Chromium to login to DAT
  - Captures session profile
  - Uploads to cloud storage
  - Requires DAT_MASTER_USERNAME and DAT_MASTER_PASSWORD
- `billing.job.ts` - Automated billing management (cron job)
  - Runs hourly to check for expired accounts and trials
  - Automatically disables accounts when billing cycle or trial expires
  - Uses node-cron for scheduling

---

## ⚙️ Configuration Files

### Client Configuration (`.env`)

```env
# API Configuration
API_BASE_URL=http://167.99.147.118:3000/api/v1
APP_BRAND_NAME=DAT Loadboard

# DAT Configuration
DEFAULT_DAT_URL=https://one.dat.com/search-loads

# Proxy Configuration
CLOUD_PROXY_ENABLED=true
CLOUD_SERVER_IP=167.99.147.118
CLOUD_PROXY_PORT=3128
CLOUD_PROXY_USERNAME=your-username
CLOUD_PROXY_PASSWORD=your-password

# Alternative proxy env vars
PROXY_USERNAME=your-username
PROXY_PASSWORD=your-password
```

### Server Configuration (`Server/.env`)

**Production Config** (`Server/production.env`):
```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database Configuration (Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:...@ep-tiny-bush-...pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

# JWT Configuration
JWT_ACCESS_SECRET=... (64+ characters)
JWT_REFRESH_SECRET=... (64+ characters)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Password Hashing
BCRYPT_SALT_ROUNDS=12

# CORS Configuration
CORS_ORIGIN=http://167.99.147.118:3000,http://localhost:3000,https://167.99.147.118

# Super Admin Bootstrap
SUPER_ADMIN_EMAIL=superadmin@digitalstorming.com
SUPER_ADMIN_PASSWORD=ChangeMeSuperSecure123!

# DigitalOcean Spaces Configuration
OBJECT_STORAGE_ENDPOINT=https://dat-commercial-2.nyc3.digitaloceanspaces.com
OBJECT_STORAGE_BUCKET=dat-commercial-2
OBJECT_STORAGE_ACCESS_KEY=DO8016G6D2TBEEGNXR92
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_REGION=nyc3

# Session Bundle Encryption
SESSION_BUNDLE_ENCRYPTION_KEY=... (32-byte base64)

# Proxy Configuration
PROXY_USERNAME=loadboard_proxy
PROXY_PASSWORD=DS!Pr0xy#2025$Secur3

# Optional: DAT Credentials (for automated session seeding)
DAT_MASTER_USERNAME=...
DAT_MASTER_PASSWORD=...

# Optional: Playwright Configuration
SEEDER_PLAYWRIGHT_WS_ENDPOINT=
API_BASE_URL=
SEEDER_API_TOKEN=

# Proxy Settings
DEFAULT_PROXY_ROTATION_INTERVAL_MINUTES=15

# Logging
LOG_LEVEL=info
```

**TypeScript Config** (`Server/tsconfig.json`):
- Target: ES2021
- Module: CommonJS
- Strict mode enabled
- Source maps enabled
- Output: `dist/` directory

**PM2 Config** (`Server/ecosystem.config.js`):
- App name: `dat-loadboard-server`
- Script: `./dist/server.js`
- Instances: `max` (cluster mode)
- Max memory: 1GB per instance
- Logs: `./logs/`
- Auto-restart enabled

### Session Capture Configuration (`session-config.env`)

```env
API_BASE_URL=http://167.99.147.118:3000/api/v1
API_EMAIL=superadmin@dat.com
API_PASSWORD=ChangeMeSuperSecure123!
SESSION_ID=cmgsg863g0001tpngelspcz9k
```

---

## 🔨 Build System

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "electron .",
    "start": "electron .",
    "build": "electron-builder --dir",
    "dist": "electron-builder --publish never",
    "create-icon": "node scripts/create-windows-icon.js",
    "embed-icon": "node scripts/embed-icon.js",
    "prebuild": "npm run create-icon",
    "predist": "npm run create-icon",
    "postbuild": "npm run embed-icon",
    "postdist": "npm run embed-icon"
  }
}
```

### Build Process

1. **Pre-build**: `create-icon` - Generates `build/icon.ico` from PNG assets
2. **Build**: `electron-builder` - Packages app into installer
3. **Post-build**: `embed-icon` - Embeds icon into executable using rcedit

### Electron Builder Configuration

**Output**: `release-icon-embed/`  
**Installer**: NSIS (Windows)  
**Icon**: `build/icon.ico`  
**App ID**: `com.dat.loadboard`  
**Product Name**: `DAT Loadboard`

**Key Settings**:
- `requestedExecutionLevel: requireAdministrator` - Admin required
- `oneClick: false` - Custom installer
- `createDesktopShortcut: false` - Manual shortcut creation
- `createStartMenuShortcut: false` - Manual shortcut creation
- `asar: true` - Package as ASAR archive
- `asarUnpack: ["public/assets/icon.ico", "public/assets/icon.png"]` - Unpack icons

---

## 🎨 Icon System

### Icon Files

**Source Files** (in `public/assets/`):
- `icon-16x16.png` - Small icon
- `icon-32x32.png` - Standard icon
- `icon-48x48.png` - Medium icon
- `icon-256x256.png` - Large icon
- `icon.png` - Fallback
- `icon.ico` - Windows ICO (if provided)

**Generated File** (in `build/`):
- `icon.ico` - Multi-resolution ICO (16, 32, 48, 256)

### Icon Resolution Logic

The `resolveAppIcon()` function tries multiple paths:
1. Production unpacked: `app.asar.unpacked/public/assets/icon.ico`
2. Production root: `resources/build/icon.ico`
3. Development: `public/assets/icon.ico`
4. Development: `build/icon.ico`
5. Fallbacks: Various other paths

### Icon Embedding

**Tools**: `rcedit` (Node.js API)  
**Hooks**: 
- `after-pack.js` - Embeds after packaging
- `after-all-artifacts.js` - Embeds after installer creation
- `embed-icon.js` - Manual embedding script

**Embedded Info**:
- Icon resource
- Version strings (FileDescription, ProductName, CompanyName, etc.)
- File version: 1.0.0
- Product version: 1.0.0

---

## 💾 Session Management

### Session Storage

**Location**: `%APPDATA%\dat-loadboard\Partitions\session-{sessionId}\`

**Structure**:
```
session-{sessionId}/
├── Network/
│   └── Cookies          # Critical: Authentication cookies
├── Local Storage/
│   └── leveldb/         # Critical: App state
├── Session Storage/     # Critical: Session data
├── Preferences          # Critical: Browser preferences
├── IndexedDB/          # Database storage
├── WebStorage/         # Web storage
└── Cache/              # Excluded from upload (98% of size)
```

### Session Lifecycle

1. **Super Admin Setup**:
   - Login as super admin
   - Launch fresh DAT session
   - Login to DAT manually
   - Browse DAT for 1-2 minutes
   - Close app
   - Run `capture-session.bat` or `session-capture-script.js`
   - Script uploads session to cloud
   - Backend marks session as READY

2. **Regular User**:
   - Login to app
   - App downloads session bundle from cloud
   - Extracts to local partition
   - Launches DAT window with session
   - User is automatically logged in

3. **Session Update**:
   - Super admin updates session
   - Runs capture script again
   - New bundle uploaded
   - Regular users get new bundle on next login

### Session Bundle Format

**Format**: ZIP file  
**Contents**: All session files except cache  
**Upload**: DigitalOcean Spaces (S3-compatible)  
**Download**: Signed URL (presigned, expires in 1 hour)

**Critical Files** (always included):
- `Network/Cookies` - Authentication
- `Local Storage/` - App state
- `Session Storage/` - Session data
- `Preferences` - Browser settings

**Excluded Files** (to reduce size):
- `Cache/` - Can be regenerated (98% of size)
- `Code Cache/` - Can be regenerated
- `GPUCache/` - Can be regenerated

### Session Validation

**Function**: `validateSessionCompleteness(sessionDir)`

**Checks**:
- Network directory exists and not empty
- Local Storage directory exists and not empty
- Session Storage directory exists and not empty
- Preferences file exists

**Returns**:
```javascript
{
  isComplete: boolean,
  missing: string[],
  present: string[]
}
```

---

## 🔐 Authentication & Security

### Authentication Flow

1. **Login**:
   - User enters email/password
   - Client sends to `/auth/login`
   - Backend validates credentials
   - Returns JWT tokens (access + refresh) + user info
   - Client stores tokens in memory

2. **Token Refresh**:
   - Access token expires (15 minutes)
   - Client calls `/auth/refresh` with refresh token
   - Backend returns new access token
   - Client updates stored token

3. **Session Validation**:
   - Client validates session every 5 seconds
   - Calls `/auth/session-status`
   - Backend checks token validity
   - Returns `{ valid: boolean, reason?: string }`

4. **Logout**:
   - Client calls `/auth/logout` (optional)
   - Backend invalidates session
   - Client clears tokens

### Security Features

**Single Session Enforcement**:
- Only one active session per user
- Login from new device invalidates old session
- Client detects invalidation and auto-logouts

**Role-Based Access**:
- `SUPER_ADMIN` - Can access DAT login page, mark sessions ready
- `ADMIN` - User management
- `USER` - Regular user, cannot access DAT login page

**DAT Login Page Blocking**:
- Non-super-admin users blocked from `login.dat.com`
- Redirected to `access-denied.html`
- Checked on multiple navigation events

**Device Fingerprinting**:
- MAC address
- Machine ID
- OS info
- Used for session tracking

**Session Invalidation**:
- Detects login from another device
- Invalidates old session immediately
- Client auto-logouts after 3 consecutive validation failures

---

## 🌐 Proxy Configuration

### Proxy Setup

**Type**: HTTP Proxy (Squid)  
**Server**: 167.99.147.118:3128  
**Purpose**: IP masking (all DAT traffic appears from proxy IP)

**Configuration**:
- Set globally via `app.commandLine.appendSwitch('proxy-server', ...)`
- Bypass: API server, localhost
- Authentication: Username/password from env vars

**Proxy Authentication**:
- Handled in `app.on('login')` event
- Uses `PROXY_USERNAME` and `PROXY_PASSWORD`
- Prevents infinite loops (max 5 attempts)

**Verification**:
- Test via `test:ip` IPC handler
- Opens `whatismyipaddress.com` in new window
- Should show proxy server IP

---

## 🗄️ Database Schema

### Prisma Schema (Complete Models)

**Enums**:
- `UserRole`: SUPER_ADMIN, ADMIN, SUPPORT, USER
- `UserStatus`: ACTIVE, SUSPENDED, DISABLED
- `ProxyProtocol`: HTTP, HTTPS, SOCKS5
- `ProxyHealthStatus`: UNKNOWN, HEALTHY, DEGRADED, UNHEALTHY
- `DatSessionStatus`: READY, PENDING, AUTH_ERROR, PROXY_ERROR, DOWNLOADING, UPLOADING, DISABLED
- `LogLevel`: INFO, WARN, ERROR
- `SecurityAlertType`: MULTIPLE_DEVICE_LOGIN, SUSPICIOUS_LOCATION, FORCED_LOGOUT, FAILED_LOGIN_ATTEMPT
- `SecurityAlertSeverity`: LOW, MEDIUM, HIGH, CRITICAL
- `BillingCycle`: DAILY, WEEKLY, MONTHLY, THREE_MONTHS, HALF_YEAR, YEARLY
- `PaymentStatus`: PAID, UNPAID, PENDING, REFUNDED

**User**:
```prisma
model User {
  id                   String            @id @default(cuid())
  email                String            @unique
  passwordHash         String
  role                 UserRole          @default(USER)
  status               UserStatus        @default(ACTIVE)
  lastLoginAt          DateTime?
  lastLoginIP          String?
  currentSessionToken  String?           # For single session enforcement
  billingCycle         BillingCycle?     # User's billing cycle type
  billingCycleStartDate DateTime?        # When current billing cycle started
  billingCycleEndDate   DateTime?        # When current billing cycle ends
  trialPeriodHours     Int?              # Trial period in hours
  trialStartDate       DateTime?         # When trial started
  trialEndDate         DateTime?         # When trial ends
  isTrialActive        Boolean           @default(false) # Is trial currently active
  isBillingActive      Boolean           @default(true)   # Is billing active (not expired)
  lastBillingCheckAt  DateTime?          # Last time billing was checked
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt
  sessions             DatSession[]      @relation("SessionAssignedUser")
  auditLogs            AuditLog[]
  loginHistory         LoginHistory[]
  sessionActivities    SessionActivity[]
  securityAlerts       SecurityAlert[]
  payments             Payment[]         # Payment history
  billingHistory       BillingHistory[]  # Billing action history
}
```

**DatSession**:
```prisma
model DatSession {
  id              String           @id @default(cuid())
  name            String           @unique
  status          DatSessionStatus @default(PENDING)
  bundleKey       String?          # S3/Spaces key
  bundleChecksum  String?
  bundleEncryption String?
  bundleVersion   Int              @default(0)
  lastLoginAt     DateTime?
  lastSyncedAt    DateTime?
  notes           String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  proxyId         String?
  domainId        String?
  assignedUserId  String?          # For shared session, this is null
  proxy           Proxy?           @relation(fields: [proxyId], references: [id])
  domain          Domain?          @relation(fields: [domainId], references: [id])
  assignedUser    User?            @relation("SessionAssignedUser", fields: [assignedUserId], references: [id])
  logs            DatSessionLog[]
}
```

**LoginHistory**:
```prisma
model LoginHistory {
  id            String   @id @default(cuid())
  userId        String
  email         String
  ipAddress     String?
  location      String?  # Human-readable location
  city          String?
  country       String?
  latitude      Float?
  longitude     Float?
  macAddress    String?
  deviceInfo    String?  # Device fingerprint
  userAgent     String?
  success       Boolean  @default(true)
  failureReason String?
  loginAt       DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([loginAt])
  @@index([success])
}
```

**SessionActivity**:
```prisma
model SessionActivity {
  id             String    @id @default(cuid())
  userId         String
  sessionToken   String    # JWT access token
  ipAddress      String?
  location       String?
  city           String?
  country        String?
  latitude       Float?
  longitude      Float?
  macAddress     String?
  deviceInfo     String?
  userAgent      String?
  loginAt        DateTime  @default(now())
  logoutAt       DateTime?
  lastActivityAt DateTime  @default(now())
  isActive       Boolean   @default(true)
  logoutReason   String?   # 'manual', 'forced_by_admin', 'new_login', etc.
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([sessionToken])
  @@index([isActive])
}
```

**SecurityAlert**:
```prisma
model SecurityAlert {
  id          String                  @id @default(cuid())
  userId      String?
  alertType   SecurityAlertType
  severity    SecurityAlertSeverity   @default(MEDIUM)
  message     String
  metadata    Json?                   # Additional context
  isRead      Boolean                 @default(false)
  isDismissed Boolean                 @default(false)
  createdAt   DateTime                @default(now())
  user        User?                   @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
  @@index([alertType])
}
```

**AuditLog**:
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?  # User who performed action
  action     String   # e.g., 'USER_CREATED', 'SESSION_DELETED'
  targetType String   # e.g., 'USER', 'SESSION', 'DOMAIN'
  targetId   String?  # ID of affected resource
  metadata   Json?    # Additional context
  ipAddress  String?
  createdAt  DateTime @default(now())
  actor      User?    @relation(fields: [actorId], references: [id])
}
```

**Domain**:
```prisma
model Domain {
  id            String       @id @default(cuid())
  label         String       # Display name
  baseUrl       String       # e.g., 'https://one.dat.com'
  description   String?
  isMaintenance Boolean      @default(false)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  sessions      DatSession[]
}
```

**Proxy**:
```prisma
model Proxy {
  id             String            @id @default(cuid())
  name           String
  host           String
  port           Int
  username       String?
  password       String?
  protocol       ProxyProtocol     @default(HTTP)
  healthStatus   ProxyHealthStatus @default(UNKNOWN)
  lastCheckedAt  DateTime?
  isActive       Boolean           @default(true)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  sessions       DatSession[]
}
```

**DatSessionLog**:
```prisma
model DatSessionLog {
  id         String   @id @default(cuid())
  sessionId  String
  level      LogLevel @default(INFO)
  message    String
  context    Json?    # Additional context
  createdAt  DateTime @default(now())
  session    DatSession @relation(fields: [sessionId], references: [id])
}
```

**Payment**:
```prisma
model Payment {
  id            String        @id @default(cuid())
  userId        String
  amount        Decimal       # Payment amount
  billingCycle  BillingCycle  # Cycle type for this payment
  status        PaymentStatus @default(PAID)
  paymentDate   DateTime      @default(now())
  cycleStartDate DateTime     # When this payment's cycle starts
  cycleEndDate   DateTime     # When this payment's cycle ends
  memo          String?       # Admin notes/memo
  createdBy     String?       # Admin who created the payment
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([status])
  @@index([paymentDate])
  @@index([cycleEndDate])
}
```

**BillingHistory**:
```prisma
model BillingHistory {
  id        String   @id @default(cuid())
  userId    String
  action    String   # e.g., 'PAYMENT_ADDED', 'TRIAL_STARTED', 'CYCLE_STARTED', 'ACCOUNT_DISABLED'
  details   Json?    # Additional context (amount, cycle, etc.)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

---

## 🌍 API Endpoints

### Authentication

- `POST /api/v1/auth/login` - Login
  - Body: `{ email, password, macAddress?, deviceMetadata? }`
  - Returns: `{ tokens: { accessToken, refreshToken }, user: {...} }`
  - Features: Single session enforcement, login history, security alerts

- `POST /api/v1/auth/refresh` - Refresh token
  - Body: `{ refreshToken }`
  - Returns: `{ tokens: { accessToken, refreshToken } }`

- `GET /api/v1/auth/me` - Get current user
  - Headers: `Authorization: Bearer {token}`
  - Returns: `{ id, email, role, status, ... }`

- `GET /api/v1/auth/session-status` - Check session validity
  - Headers: `Authorization: Bearer {token}`
  - Returns: `{ valid: boolean, reason?: string }`

### Sessions

- `GET /api/v1/sessions/my-sessions` - Get user sessions (shared session)
  - Returns: `Session[]` (all users get same shared session)

- `GET /api/v1/sessions/shared-stats` - Get shared session statistics
  - Returns: `{ sharedSessionId, sharedSessionName, sharedSessionStatus, totalActiveUsers, ... }`

- `POST /api/v1/sessions/:id/request-download` - Get download URL
  - Returns: `{ url: string, bundleKey: string, expiresInSeconds: number }`
  - URL expires in 15 minutes (900 seconds)

- `POST /api/v1/sessions/:id/request-upload` - Get upload URL
  - Body: `{ contentType?: 'application/zip', expiresInSeconds?: number }`
  - Returns: `{ url: string, bundleKey: string, expiresInSeconds: number }`

- `POST /api/v1/sessions/:id/complete-upload` - Complete upload
  - Body: `{ checksum?: string, fileSizeBytes?: number, encryption?: string }`
  - Updates session status to READY

- `POST /api/v1/sessions/:id/mark-ready` - Mark session ready (Super Admin)
  - Changes status from PENDING to READY

- `POST /api/v1/sessions/:id/events` - Record session event
  - Body: `{ level: 'INFO'|'WARN'|'ERROR', message: string, context?: object }`
  - Used for logging session operations

- `GET /api/v1/sessions` - List all sessions (Admin only)
- `POST /api/v1/sessions` - Create session (Admin only)
- `PATCH /api/v1/sessions/:id` - Update session (Admin only)
- `DELETE /api/v1/sessions/:id` - Delete session (Admin only)

### Users (Admin Only)

- `GET /api/v1/users` - List users (with filters)
- `POST /api/v1/users` - Create user
  - Body: `{ email, password, role, status }`
- `PATCH /api/v1/users/:id` - Update user
- `PATCH /api/v1/users/:id/password` - Change password
  - Body: `{ password: string }`
- `PATCH /api/v1/users/:id/status` - Toggle user status
  - Body: `{ status: 'ACTIVE'|'SUSPENDED'|'DISABLED' }`
- `PATCH /api/v1/users/:id/role` - Update user role
  - Body: `{ role: 'USER'|'ADMIN'|'SUPER_ADMIN'|'SUPPORT' }`
- `DELETE /api/v1/users/:id` - Delete user

### Login History

- `GET /api/v1/login-history/me` - Get current user's login history
  - Query: `?limit=50`
  - Returns: `LoginHistory[]`

- `GET /api/v1/login-history/me/stats` - Get current user's login statistics
  - Returns: `{ totalLogins, failedLogins, successRate, lastLogin, uniqueIPCount, ... }`

- `GET /api/v1/login-history` - Get all login history (Admin only)
  - Query: `?limit=100&userId=...&success=true&startDate=...&endDate=...`
  - Returns: `LoginHistory[]` with user info

### Session Activity

- `GET /api/v1/sessions/active/me` - Get current user's active session
  - Returns: `SessionActivity[]`

- `GET /api/v1/sessions/history/me` - Get current user's session history
  - Query: `?limit=50`
  - Returns: `SessionActivity[]`

- `GET /api/v1/sessions/active` - Get all active sessions (Admin only)
  - Query: `?limit=100`
  - Returns: `SessionActivity[]` with user info

- `GET /api/v1/sessions/stats` - Get session statistics (Admin only)
  - Returns: `{ totalActiveSessions, totalUsers, activeUsersCount, sessionsToday, ... }`

- `POST /api/v1/sessions/:id/logout` - Force logout a session (Admin only)
  - Returns: `{ success: true, userId, userEmail }`

- `POST /api/v1/sessions/logout-all/:userId` - Logout all sessions for a user (Admin only)
  - Returns: `{ message: string, count: number }`

### Security Alerts (Admin Only)

- `GET /api/v1/security-alerts/unread` - Get unread alerts
  - Query: `?limit=50`
  - Returns: `SecurityAlert[]`

- `GET /api/v1/security-alerts/unread/count` - Get unread alert count
  - Returns: `{ count: number }`

- `GET /api/v1/security-alerts/stats` - Get alert statistics
  - Returns: `{ total, unread, today, bySeverity, byType }`

- `GET /api/v1/security-alerts` - Get all alerts with filters
  - Query: `?limit=100&isRead=true&isDismissed=false&alertType=...&severity=...&startDate=...&endDate=...`
  - Returns: `SecurityAlert[]`

- `POST /api/v1/security-alerts/:id/read` - Mark alert as read
- `POST /api/v1/security-alerts/read-all` - Mark all alerts as read
- `POST /api/v1/security-alerts/:id/dismiss` - Dismiss alert

### Audit Logs (Admin Only)

- `GET /api/v1/audit` - List audit logs
  - Query: `?limit=100`
  - Returns: `AuditLog[]` with actor info

### Domains (Admin/Support)

- `GET /api/v1/domains` - List domains
- `POST /api/v1/domains` - Create domain
  - Body: `{ label, baseUrl, description? }`
- `PATCH /api/v1/domains/:id` - Update domain
  - Body: `{ label?, baseUrl?, description?, isMaintenance? }`
- `DELETE /api/v1/domains/:id` - Delete domain

### Billing (Admin Only)

- `POST /api/v1/billing/:userId/start-cycle` - Start billing cycle for user
  - Body: `{ cycle: BillingCycle, startDate?: DateTime }`
  - Calculates end date based on cycle type
  - Creates billing history entry

- `POST /api/v1/billing/:userId/add-payment` - Add payment for user
  - Body: `{ cycle: BillingCycle, amount: Decimal, memo?: string }`
  - Starts billing cycle if not already active
  - Creates payment record and billing history entry

- `GET /api/v1/billing/:userId/status` - Get user billing status
  - Returns: `{ user: {...}, isExpired: boolean, isTrialActive: boolean, daysRemaining: number, ... }`

- `GET /api/v1/billing/:userId/payments` - Get payment history for user
  - Returns: `{ payments: Payment[] }`

- `GET /api/v1/billing/:userId/history` - Get billing history for user
  - Returns: `{ history: BillingHistory[] }`

- `POST /api/v1/billing/:userId/set-trial` - Set trial period for user
  - Body: `{ hours: number }`
  - Starts trial period from now
  - Creates billing history entry

- `GET /api/v1/billing/expired` - Get count of expired accounts (Admin only)
  - Returns: `{ total: number }`

- `POST /api/v1/billing/check-expired` - Check and disable expired accounts (Admin only)
  - Automatically disables all expired accounts
  - Returns: `{ disabled: number }`

### Health Check

- `GET /api/v1/healthz` - Application health status
  - Returns: `{ status: 'ok', timestamp: string }`

---

## 🚀 Deployment

### Server Deployment

**Server IP**: 167.99.147.118  
**Port**: 3000  
**Process Manager**: PM2  
**Database**: Neon PostgreSQL (ep-billowing-pine-ah09chf3-pooler.us-east-1.aws.neon.tech)  
**Storage**: DigitalOcean Spaces (dat-commercial-2.nyc3.digitaloceanspaces.com)
**GitHub Repository**: https://github.com/shahrukhfiaz/lb2new

**Deployment Script**: `Server/deploy-new-server.sh`

**Steps**:
1. SSH to server
2. Clone/upload code
3. Run deployment script
4. Configure environment
5. Run migrations
6. Start with PM2

### Client Deployment

**Build Command**: `npm run dist`  
**Output**: `release-icon-embed/DAT Loadboard-1.0.0-Setup.exe`  
**Installer**: NSIS (Windows)

**Steps**:
1. Configure `.env` file
2. Install dependencies
3. Build installer: `npm run dist`
4. Distribute installer
5. Users install and run

### Environment Files

**Client**: `.env` (copy from `client-production.env`)  
**Server**: `Server/.env` (copy from `Server/production.env`)  
**Session Capture**: `session-config.env` (copy from `session-config.env.example`)

---

## 💻 Development Workflow

### Local Development

1. **Start Backend**:
   ```bash
   cd Server
   npm install
   npm run dev
   ```

2. **Start Client**:
   ```bash
   npm install
   npm run dev
   ```

3. **Test**:
   - Login with test user
   - Verify DAT opens
   - Test tab creation
   - Test logout

### Building for Production

1. **Client**:
   ```bash
   npm run create-icon  # Generate icon
   npm run dist         # Build installer
   ```

2. **Server**:
   ```bash
   cd Server
   npm run build        # Compile TypeScript
   npm run db:migrate   # Run migrations
   ```

### Session Capture Workflow

1. **Super Admin Setup**:
   - Login as super admin
   - Launch fresh DAT
   - Login to DAT
   - Browse for 1-2 minutes
   - Close app

2. **Capture Session**:
   ```bash
   node session-capture-script.js [sessionId]
   ```
   - Script finds session directory
   - Zips session files
   - Uploads to cloud
   - Marks session as ready

3. **Test Regular User**:
   - Login as regular user
   - Verify session downloads
   - Verify DAT opens with login

---

## ✨ Key Features

### 1. Chrome-like Tab System
- Multiple tabs in single window
- Tab switching, closing, renaming
- Custom tab bar UI (hardcoded in window)
- BrowserView-based tabs

### 2. Session Sharing
- Single session shared across all users
- Super admin sets up session
- Regular users get pre-configured session
- Automatic login to DAT

### 3. IP Masking
- All DAT traffic routes through proxy
- Appears from cloud server IP
- Configurable via environment

### 4. Security
- Single session enforcement
- Role-based access control
- DAT login page blocking
- Session validation
- Device fingerprinting

### 5. Icon System
- Multi-resolution ICO file
- Embedded in executable
- Proper Windows support
- Automatic generation

### 6. Auto-Launch
- Session auto-launches after login
- Hides login window
- Shows DAT window
- Handles errors gracefully

---

## 🐛 Known Issues & Solutions

### Icon Not Showing

**Issue**: Icon doesn't appear in taskbar/shortcuts  
**Solution**:
1. Run `scripts/clear-icon-cache.bat`
2. Rebuild: `npm run create-icon && npm run dist`
3. Reinstall app
4. Clear Windows icon cache: `ie4uinit.exe -show`

### Session Not Downloading

**Issue**: Session download fails  
**Solution**:
1. Check API connection: `curl http://167.99.147.118:3000/api/v1/healthz`
2. Verify session is READY in database
3. Check Spaces bucket exists and accessible
4. Verify signed URL generation works

### File Locking During Capture

**Issue**: Cookies file locked during capture  
**Solution**:
- Use standalone `session-capture-script.js` (runs after app closes)
- Script has retry logic for locked files
- Multiple strategies for file reading

### Tab Bar Not Showing

**Issue**: Tab bar doesn't appear  
**Solution**:
1. Check `tab-bar.html` exists in `public/`
2. Verify preload script loads
3. Check IPC communication
4. Verify window is frameless (`frame: false`)

### Proxy Not Working

**Issue**: IP not masked  
**Solution**:
1. Verify `CLOUD_PROXY_ENABLED=true`
2. Check proxy credentials
3. Test proxy connection
4. Verify proxy server is running

---

## 📝 Important Notes

### File Paths

**Development**:
- User Data: `%APPDATA%\dat-loadboard\`
- Partitions: `%APPDATA%\dat-loadboard\Partitions\session-{id}\`

**Production**:
- Install Directory: `C:\Program Files\DAT Loadboard\`
- User Data: `%APPDATA%\dat-loadboard\`
- Logs: `%APPDATA%\dat-loadboard\logs\`

### Partition Naming

- Electron partition: `persist:session-{sessionId}`
- Actual directory: `Partitions\session-{sessionId}\`
- Electron maps `persist:` prefix automatically

### Session Status

- `PENDING` - Session not ready (super admin setup required)
- `READY` - Session ready (users can download)

### User Roles

- `SUPER_ADMIN` - Can access DAT login, mark sessions ready
- `ADMIN` - User management
- `USER` - Regular user

### Default Credentials

**Super Admin**:
- Email: `superadmin@digitalstorming.com`
- Password: `ChangeMeSuperSecure123!` ⚠️ CHANGE IN PRODUCTION!

---

## 🔄 Recent Changes

### Icon System
- Added multi-resolution ICO generation
- Added icon embedding hooks
- Added icon resolution with fallbacks
- Added Windows icon cache clearing

### Tab System
- Implemented Chrome-like tabs with BrowserView
- Added custom tab bar UI
- Added tab title editing
- Added security checks for DAT login page

### Session Management
- Optimized session capture (excludes cache)
- Added standalone capture script
- Added session validation
- Added automatic session sharing
- Added shared session service (all users share one session)

### Security
- Added single session enforcement
- Added role-based access control
- Added DAT login page blocking
- Added device fingerprinting
- Added login history tracking with geolocation
- Added security alerts system (multiple device login, suspicious location, failed login attempts)
- Added session activity monitoring
- Added audit logging for all admin actions
- Added force logout capability for admins

### Backend Enhancements
- Added comprehensive login history service
- Added session activity tracking service
- Added security alert service
- Added audit logging service
- Added domain management service
- Added session assignment service
- Added session bundle service (presigned URLs)
- Added shared session service
- Added admin panel with multiple tabs (Users, Sessions, Login History, Active Sessions, Security Alerts, Dashboard, Billing)
- Added Playwright-based session seeder worker
- Added geolocation utilities (IP to location, distance calculation)
- Added device fingerprinting utilities
- Added billing system (billing cycles, payments, trial periods, auto-disable)
  - Billing service with cycle calculation, payment tracking, trial management
  - Billing controller with REST API endpoints
  - Billing routes protected by admin roles
  - Background cron job (billing.job.ts) for hourly expired account checks
  - Payment and BillingHistory models in database
  - User model extended with billing fields (billingCycle, trialPeriodHours, etc.)
  - Login authentication checks billing status before allowing access
- Updated server IP to 167.99.147.118 (from 67.205.189.32)
- Updated database to new Neon PostgreSQL instance
- Updated object storage to new DigitalOcean Spaces bucket (dat-commercial-2)

### Admin Panel Enhancements
- Added Dashboard tab with:
  - Currently logged-in users widget
  - Billing overview widget
  - System statistics (total users, expired accounts, expiring soon)
  - Auto-refresh every minute
- Added Billing tab with:
  - User billing status table
  - Billing cycle management
  - Payment recording (with memo/notes)
  - Trial period management
  - Payment history modal
  - Expired accounts alert and auto-disable
  - Billing statistics cards
- Enhanced Users tab:
  - Added "Login Status" column showing online/offline status
  - Added billing information columns (Billing Cycle, End Date, Days Remaining)
  - Improved table layout and styling
  - Better date formatting and status badges
- Fixed UI/UX issues:
  - Removed duplicate email column
  - Fixed table column alignment
  - Improved modal display (fixed billing popups showing on page load)
  - Better responsive table container with sticky headers

---

## 📚 Additional Resources

### Documentation Files
- `README.md` - Main readme
- `SETUP.md` - Setup guide
- `DEPLOYMENT_INSTRUCTIONS.md` - Deployment guide
- `ICON_FIX_GUIDE.md` - Icon troubleshooting
- `ICON_REQUIREMENTS.md` - Icon requirements
- `build/ICON_SETUP.md` - Icon setup
- `Server/README.md` - Server documentation

### Scripts
- `session-capture-script.js` - Standalone session capture
- `mark-session-ready.js` - Mark session ready
- `capture-session.bat` - Batch wrapper for capture
- `capture-session.ps1` - PowerShell wrapper

### Configuration Templates
- `client-production.env` - Client production config
- `Server/production.env` - Server production config (complete with all credentials)
- `Server/CLOUD_CONFIG.env` - Cloud deployment config template
- `Server/NEW_SERVER_CONFIG.env` - New server deployment config
- `Server/env.example` - Server environment variable template
- `session-config.env.example` - Session capture config
- `CLOUD_CONFIG.env` - Cloud config (root level)
- `NEW_SERVER_CONFIG.env` - New server config (root level)

### Additional Files
- `src/main/main.js.backup` - Backup of main.js
- `src/main/main-new.js` - New version of main.js (currently empty)
- `Server/bootstrap-super-admin.js` - Script to create super admin user
- `Server/test-s3-from-app.js` - S3/Spaces connection test script
- `Server/cloud-proxy-server.js` - Cloud proxy server implementation
- `Server/proxy-server.js` - Simple proxy server for testing

---

**End of Project Context Document**

*This document should be updated whenever significant changes are made to the project structure, architecture, or configuration.*

