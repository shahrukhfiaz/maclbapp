// Load environment variables with explicit path
const path = require('path');
const dotenv = require('dotenv');

// Determine the correct path for .env file
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require('electron');
const axios = require('axios').default;
const AdmZip = require('adm-zip');
const { initializeProxy, createProxiedSession, testProxyConnection } = require('./proxyConfig');
const { machineIdSync } = require('node-machine-id');
const macaddress = require('macaddress');
const { TabManager } = require('./tabManager');

// Set AppUserModelId for Windows IMMEDIATELY - must be before any windows are created
// This ensures correct icon and name in taskbar when app is pinned
// CRITICAL: Must be set before app.whenReady() to ensure Windows uses it when pinning
if (process.platform === 'win32') {
  // Set AppUserModelId BEFORE app is ready - this is critical for taskbar pinning
  app.setAppUserModelId('com.dat.loadboard');
  
  // Also set it in the registry immediately to ensure Windows picks it up
  // This helps when users pin the app before it fully starts
  try {
    const { execSync } = require('child_process');
    execSync(`reg add "HKCU\\Software\\Classes\\AppUserModelId\\com.dat.loadboard" /v "" /t REG_SZ /d "DAT Loadboard" /f`, { stdio: 'ignore' });
    execSync(`reg add "HKCU\\Software\\Classes\\AppUserModelId\\com.dat.loadboard" /v "DisplayName" /t REG_SZ /d "DAT Loadboard" /f`, { stdio: 'ignore' });
  } catch (error) {
    // Ignore registry errors - app.setAppUserModelId should be sufficient
  }
}

// Silent logger - only log errors in production
const isDev = process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true';

// Set up file logging for debugging (initialize after app is ready)
let logDir = null;
let logFile = null;

// Helper function to initialize log file path
function initializeLogFile() {
  try {
    logDir = path.join(app.getPath('userData'), 'logs');
    logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    return true;
  } catch (err) {
    // Fallback to temp directory if userData not available yet
    try {
      logDir = path.join(os.tmpdir(), 'dat-loadboard-logs');
      logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      return true;
    } catch (fallbackErr) {
      return false;
    }
  }
}

// Helper function to write to log file
function writeToLogFile(level, message) {
  try {
    // Initialize log file if not already done
    if (!logFile) {
      initializeLogFile();
    }
    
    if (logFile) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level}] ${message}\n`;
      fs.appendFileSync(logFile, logMessage, 'utf8');
    }
  } catch (err) {
    // Ignore file write errors - don't break the app
  }
}

// Enhanced logger that writes to both console and file
const logger = {
  log: function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (isDev) {
      console.log(...args);
    }
    writeToLogFile('LOG', message);
  },
  info: function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (isDev) {
      console.info(...args);
    }
    writeToLogFile('INFO', message);
  },
  warn: function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (isDev) {
      console.warn(...args);
    }
    writeToLogFile('WARN', message);
  },
  error: function(...args) {
    // Always log errors to both console and file
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    console.error(...args);
    writeToLogFile('ERROR', message);
  },
  debug: function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (isDev) {
      console.log(...args);
    }
    writeToLogFile('DEBUG', message);
  }
};

// Helper function to collect device information for session tracking
async function collectDeviceInfo() {
  try {
    // Get MAC address
    const mac = await new Promise((resolve, reject) => {
      macaddress.one((err, addr) => {
        if (err) resolve('unknown');
        else resolve(addr);
      });
    });

    // Get machine ID
    let machineId;
    try {
      machineId = machineIdSync();
    } catch (err) {
      machineId = 'unknown';
    }

    // Collect OS and system info
    const deviceInfo = {
      macAddress: mac,
      machineId,
      os: os.platform(),
      osVersion: os.release(),
      hostname: os.hostname(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
    };

    return deviceInfo;
  } catch (error) {
        logger.error('Error collecting device info:', error);
    return {
      macAddress: 'unknown',
      os: os.platform(),
      hostname: os.hostname(),
    };
  }
}

// Comprehensive session validation function (moved to global scope)
const validateSessionCompleteness = (sessionDir) => {
  const validation = {
    isComplete: true,
    missing: [],
    present: []
  };
  
  // Critical components for login state
  const criticalComponents = [
    { name: 'Network Directory', path: path.join(sessionDir, 'Network') },
    { name: 'Local Storage Directory', path: path.join(sessionDir, 'Local Storage') },
    { name: 'Session Storage Directory', path: path.join(sessionDir, 'Session Storage') },
    { name: 'Preferences File', path: path.join(sessionDir, 'Preferences') }
  ];
  
  for (const component of criticalComponents) {
    if (fs.existsSync(component.path)) {
      validation.present.push(component.name);
      try {
        if (fs.statSync(component.path).isDirectory()) {
          const contents = fs.readdirSync(component.path);
          if (contents.length === 0) {
            logger.log(`?? ${component.name} is empty`);
            validation.missing.push(`${component.name} (empty)`);
            validation.isComplete = false;
          } else {
            logger.log(`?? ${component.name} contains ${contents.length} items`);
          }
        } else {
          logger.log(`?? ${component.name} found`);
        }
      } catch (err) {
        validation.missing.push(`${component.name} (unreadable)`);
        validation.isComplete = false;
      }
    } else {
      validation.missing.push(component.name);
      validation.isComplete = false;
    }
  }
  
  return validation;
};

const BRAND_NAME = process.env.APP_BRAND_NAME || 'DAT One';
const API_BASE_URL = process.env.API_BASE_URL || 'http://167.99.147.118:3000/api/v1';
const DEFAULT_DAT_URL = process.env.DEFAULT_DAT_URL || 'https://one.dat.com/search-loads';
const PROXY_USERNAME =
  process.env.CLOUD_PROXY_USERNAME ||
  process.env.CLOUD_PROXY_USER ||
  process.env.PROXY_USERNAME ||
  '';
const PROXY_PASSWORD =
  process.env.CLOUD_PROXY_PASSWORD ||
  process.env.CLOUD_PROXY_PASS ||
  process.env.PROXY_PASSWORD ||
  '';
const hasProxyCredentials = Boolean(PROXY_USERNAME && PROXY_PASSWORD);

// Log proxy credential status at startup (dev only)
logger.log(`🔐 Proxy credentials loaded:`, {
  username: PROXY_USERNAME || '❌ NOT SET',
  password: PROXY_PASSWORD ? '✅ SET (hidden)' : '❌ NOT SET',
  hasCredentials: hasProxyCredentials
});

let loginWindow = null;
let datWindow = null;
let tabManager = null; // Tab manager for Chrome-like tabs
let tokens = null;
let currentUser = null;
let currentSessionId = null; // Track the current session ID for super admin
let isIntentionalLogout = false; // Track if logout is intentional (to prevent app.quit on logout)
let http = axios.create({ baseURL: API_BASE_URL, timeout: 45000 });

function resolvePublicPath(...segments) {
  // In production, files are in asar archive or unpacked
  // Check if running from app.asar or unpacked directory
  const basePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'app.asar', 'public')
    : path.join(__dirname, '../../public');
  
  const fullPath = path.join(basePath, ...segments);
  
  // For icon files, also check unpacked location if app is packaged
  if (app.isPackaged && segments[0] === 'assets' && (segments[1]?.endsWith('.ico') || segments[1]?.endsWith('.png'))) {
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'public', ...segments);
    if (fs.existsSync(unpackedPath)) {
      return unpackedPath;
    }
  }
  
  return fullPath;
}

/**
 * Resolves the app icon path with multiple fallback locations
 * This ensures the icon is found in both development and production builds
 * @returns {string|null} Absolute path to icon file or null if not found
 */
function resolveAppIcon() {
  const iconPaths = [
    // Production paths (packaged app)
    app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'assets', 'icon.ico') : null,
    app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'icon.ico') : null,
    app.isPackaged ? path.join(process.resourcesPath, 'build', 'icon.ico') : null,
    // Development paths
    path.join(__dirname, '../../public/assets/icon.ico'),
    path.join(__dirname, '../../build/icon.ico'),
    path.join(__dirname, '../../../build/icon.ico'),
    // Fallback to resolvePublicPath
    resolvePublicPath('assets', 'icon.ico'),
    // Additional fallbacks
    path.join(process.cwd(), 'build', 'icon.ico'),
    path.join(process.cwd(), 'public', 'assets', 'icon.ico'),
  ].filter(Boolean); // Remove null values

  // Try each path and return the first one that exists
  for (const iconPath of iconPaths) {
    try {
      const absolutePath = path.resolve(iconPath);
      if (fs.existsSync(absolutePath)) {
        logger.log(`✅ Icon found at: ${absolutePath}`);
        return absolutePath;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  logger.log(`⚠️  Warning: App icon not found. Tried paths: ${iconPaths.join(', ')}`);
  return null;
}

/**
 * Sets the icon on a BrowserWindow with proper error handling
 * This is critical for Windows to show the correct icon in taskbar
 * @param {BrowserWindow} win - The BrowserWindow instance
 */
function setWindowIcon(win) {
  if (!win || win.isDestroyed()) return;
  
  const iconPath = resolveAppIcon();
  if (iconPath) {
    try {
      // Explicitly set icon after window creation (important for Windows)
      win.setIcon(iconPath);
      logger.log(`✅ Icon set on window: ${iconPath}`);
    } catch (error) {
      logger.log(`⚠️  Failed to set icon on window: ${error.message}`);
    }
  }
}

function sanitizePartitionName(partition) {
  if (!partition) return null;
  return partition.replace(/^persist:/, '');
}

function findSessionDirectory(sessionId, partition) {
  const userDataPath = app.getPath('userData');
  const partitionsDir = path.join(userDataPath, 'Partitions');
  const sanitizedPartition = sanitizePartitionName(partition);

  if (sanitizedPartition) {
    const candidate = path.join(partitionsDir, sanitizedPartition);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const defaultCandidate = path.join(partitionsDir, `session-${sessionId}`);
  if (fs.existsSync(defaultCandidate)) {
    return defaultCandidate;
  }

  if (fs.existsSync(partitionsDir)) {
    const partitions = fs.readdirSync(partitionsDir);
    const matchingPartition =
      partitions.find((name) => name.includes(sessionId)) ||
      partitions.find((name) => name.includes('session'));

    if (matchingPartition) {
      return path.join(partitionsDir, matchingPartition);
    }
  }

  return null;
}

async function uploadSessionFromDirectory(sessionDataPath, sessionId) {
  const sessionFiles = fs.readdirSync(sessionDataPath);
  logger.log(`?? Session contains: ${sessionFiles.join(', ')}`);

  const cookiesPath = path.join(sessionDataPath, 'Network', 'Cookies');
  if (fs.existsSync(cookiesPath)) {
    const cookiesSize = fs.statSync(cookiesPath).size;
    logger.log(`?? Cookies file found: ${cookiesSize} bytes`);
  } else {
    logger.log(`?? WARNING: No Cookies file found! Session may not have authentication data.`);
  }

  const buildZipPath = () => path.join(os.tmpdir(), `superadmin-session-${Date.now()}.zip`);

  // OPTIMIZED FILE CAPTURE: Exclude cache files to minimize download size
  // Analysis shows cache files are 98% of session size (113.82 MB out of 115.74 MB)
  // Critical session files are only ~1.83 MB (Network/Cookies, Local Storage, Session Storage, IndexedDB)
  const shouldIncludeFile = (filename) => {
    const normalizedPath = filename.toLowerCase().replace(/\\/g, '/');
    
    // EXCLUDE: Cache directories (can be regenerated, 98% of session size)
    if (normalizedPath.includes('cache/cache_data/') ||
        normalizedPath.includes('cache\\cache_data\\') ||
        normalizedPath.startsWith('cache/') ||
        normalizedPath.startsWith('cache\\') ||
        normalizedPath.includes('code cache/') ||
        normalizedPath.includes('code cache\\') ||
        normalizedPath.includes('gpucache/') ||
        normalizedPath.includes('gpucache\\') ||
        normalizedPath.includes('dawngraphitecache/') ||
        normalizedPath.includes('dawngraphitecache\\') ||
        normalizedPath.includes('dawnwebgpucache/') ||
        normalizedPath.includes('dawnwebgpucache\\')) {
      return false;
    }
    
    // INCLUDE: Lock files, Journal files, and WAL files
    // These are small and may help with database integrity during restoration
    // Lock files: Help maintain database state
    // Journal files: Database transaction logs for recovery
    // WAL files: Write-Ahead Logging for database consistency
    
    // INCLUDE: All critical session files
    // Network directory (contains Cookies - essential for authentication)
    if (normalizedPath.includes('network/') ||
        normalizedPath.includes('network\\')) {
      return true;
    }
    
    // Local Storage (contains app state)
    if (normalizedPath.includes('local storage/') ||
        normalizedPath.includes('local storage\\')) {
      return true;
    }
    
    // Session Storage (contains session data)
    if (normalizedPath.includes('session storage/') ||
        normalizedPath.includes('session storage\\')) {
      return true;
    }
    
    // WebStorage (contains IndexedDB and WebSQL)
    if (normalizedPath.includes('webstorage/') ||
        normalizedPath.includes('webstorage\\') ||
        normalizedPath.includes('indexeddb/') ||
        normalizedPath.includes('indexeddb\\') ||
        normalizedPath.includes('websql/') ||
        normalizedPath.includes('websql\\')) {
      return true;
    }
    
    // Preferences file (browser preferences)
    if (normalizedPath === 'preferences' ||
        normalizedPath.startsWith('preferences') ||
        filename === 'Preferences') {
      return true;
    }
    
    // Root level critical files
    if (filename === 'Local State' ||
        filename === 'Current Session' ||
        filename === 'Current Tabs' ||
        filename === 'TransportSecurity') {
      return true;
    }
    
    // Include Service Worker and Shared Dictionary (small, may be needed)
    if (normalizedPath.includes('service worker/') ||
        normalizedPath.includes('service worker\\') ||
        normalizedPath.includes('shared dictionary/') ||
        normalizedPath.includes('shared dictionary\\')) {
      return true;
    }
    
    // Include blob_storage (may contain session-related blobs)
    if (normalizedPath.includes('blob_storage/') ||
        normalizedPath.includes('blob_storage\\')) {
      return true;
    }
    
    // INCLUDE: Lock files, Journal files, and WAL files (small, help with database integrity)
    // These are included even if not in critical directories
    if (filename.endsWith('.lock') || 
        filename.endsWith('LOCK') ||
        filename === '.lock' ||
        filename === 'LOCK' ||
        filename.endsWith('.journal') || 
        filename.endsWith('-journal') ||
        filename.endsWith('.wal') || 
        filename.endsWith('-wal')) {
      return true;
    }
    
    // EXCLUDE: Everything else that's not explicitly critical
    // This ensures we only include essential session files
    return false;
  };

  // Safe file reading function with retry logic (reduced retries since Chromium locking is prevented)
  const safeReadFile = (filePath, maxRetries = 2, isCritical = false) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return fs.readFileSync(filePath);
      } catch (error) {
        if (error.code === 'EBUSY' || error.code === 'EACCES') {
          logger.log(`?? File locked, retrying ${i + 1}/${maxRetries}: ${filePath}`);
          if (i < maxRetries - 1) {
            // Reduced wait time since Chromium locking is prevented
            const waitTime = isCritical ? 200 : 100; // Much shorter wait
            const start = Date.now();
            while (Date.now() - start < waitTime) {
              // Busy wait
            }
            continue;
          }
        }
        throw error;
      }
    }
  };

  // Custom zip creation with error handling
  const createZipSafely = () => {
    const zip = new AdmZip();
    const zipPath = buildZipPath();
    const criticalFilesPreserved = [];
    
    try {
      // Add files individually with error handling
      const addDirectoryRecursively = (dirPath, zipPathPrefix = '') => {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const relativePath = path.join(zipPathPrefix, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            // Recursively add subdirectories
            addDirectoryRecursively(itemPath, relativePath);
          } else {
            // Check if file should be excluded
            if (shouldIncludeFile(relativePath)) {
              try {
                // Check if this is a critical file that we must preserve
                const isCriticalFile = relativePath.toLowerCase().includes('cookies') || 
                                      relativePath.toLowerCase().includes('local storage') ||
                                      relativePath.toLowerCase().includes('session storage') ||
                                      relativePath.toLowerCase().includes('preferences');
                
                // Special handling for Cookies file - use multiple retry strategies
                if (relativePath.toLowerCase().includes('cookies')) {
                  let cookiesCaptured = false;
                  
                  // Strategy 1: Try normal file read
                  try {
                    const fileContent = fs.readFileSync(itemPath);
                    zip.addFile(relativePath, fileContent);
                    logger.log(`?? SUCCESS: Cookies file captured normally`);
                    cookiesCaptured = true;
                  } catch (error) {
                    logger.log(`?? Cookies file locked, trying alternative strategies...`);
                  }
                  
                  // Strategy 2: Try with different file access flags
                  if (!cookiesCaptured) {
                    try {
                      const fileContent = fs.readFileSync(itemPath, { flag: 'r' });
                      zip.addFile(relativePath, fileContent);
                      logger.log(`?? SUCCESS: Cookies file captured with 'r' flag`);
                      cookiesCaptured = true;
                    } catch (error) {
                      logger.log(`?? Strategy 2 failed: ${error.message}`);
                    }
                  }
                  
                  // Strategy 3: Try copying to temp file first
                  if (!cookiesCaptured) {
                    try {
                      const tempPath = path.join(os.tmpdir(), `cookies-${Date.now()}.tmp`);
                      fs.copyFileSync(itemPath, tempPath);
                      const fileContent = fs.readFileSync(tempPath);
                      zip.addFile(relativePath, fileContent);
                      fs.unlinkSync(tempPath);
                      logger.log(`?? SUCCESS: Cookies file captured via temp copy`);
                      cookiesCaptured = true;
                    } catch (error) {
                      logger.log(`?? Strategy 3 failed: ${error.message}`);
                    }
                  }
                  
                  // Strategy 4: Try with longer wait and retry
                  if (!cookiesCaptured) {
                    for (let attempt = 1; attempt <= 5; attempt++) {
                      try {
                        // Use synchronous wait instead of async
                        const waitTime = 1000 * attempt;
                        const start = Date.now();
                        while (Date.now() - start < waitTime) {
                          // Busy wait
                        }
                        const fileContent = fs.readFileSync(itemPath);
                        zip.addFile(relativePath, fileContent);
                        logger.log(`?? SUCCESS: Cookies file captured on attempt ${attempt}`);
                        cookiesCaptured = true;
                        break;
                      } catch (error) {
                        logger.log(`?? Attempt ${attempt} failed: ${error.message}`);
                      }
                    }
                  }
                  
                  if (cookiesCaptured) {
                    criticalFilesPreserved.push(relativePath);
                    logger.log(`?? CRITICAL SUCCESS: Cookies file captured successfully!`);
                  } else {
                    logger.log(`?? CRITICAL FAILURE: All strategies failed to capture Cookies file!`);
                    logger.log(`?? WARNING: Session may not maintain login state without Cookies!`);
                  }
                } else {
                  // Normal file handling for non-Cookies files
                  const fileContent = safeReadFile(itemPath, isCriticalFile ? 3 : 2, isCriticalFile);
                  zip.addFile(relativePath, fileContent);
                  
                  // Log files being included
                  if (isCriticalFile) {
                    logger.log(`?? Including critical file: ${relativePath}`);
                    criticalFilesPreserved.push(relativePath);
                  } else {
                    logger.log(`📄 Including file: ${relativePath}`);
                  }
                }
              } catch (error) {
                if (error.code === 'EBUSY' || error.code === 'EACCES') {
                  // For critical files, we should not skip them - try alternative approach
                  const isCriticalFile = relativePath.toLowerCase().includes('cookies');
                  if (isCriticalFile) {
                    logger.log(`?? CRITICAL: Cookies file is locked, trying alternative approach...`);
                    // Try to copy the file with a different method
                    try {
                      const fs = require('fs');
                      const fileContent = fs.readFileSync(itemPath, { flag: 'r' });
                      zip.addFile(relativePath, fileContent);
                      logger.log(`?? CRITICAL: Successfully captured Cookies file!`);
                      criticalFilesPreserved.push(relativePath);
                    } catch (altError) {
                      logger.log(`?? CRITICAL ERROR: Cannot capture Cookies file: ${altError.message}`);
                      logger.log(`?? WARNING: Session may not maintain login state without Cookies!`);
                    }
                  } else {
                    logger.log(`?? Skipping locked file: ${relativePath}`);
                  }
                } else {
                  logger.log(`?? Error reading file ${relativePath}: ${error.message}`);
                }
              }
            } else {
              logger.log(`📄 Including file: ${relativePath}`);
            }
          }
        }
      };
      
      addDirectoryRecursively(sessionDataPath);
      
    zip.writeZip(zipPath);
    const zipSize = fs.statSync(zipPath).size;
    logger.log(`? Session zipped: ${zipPath} (${zipSize} bytes)`);
      
      // Log summary of critical files preserved
      if (criticalFilesPreserved.length > 0) {
        logger.log(`?? Critical files preserved for login state: ${criticalFilesPreserved.length}`);
        criticalFilesPreserved.forEach(file => logger.log(`   ✅ ${file}`));
      } else {
        logger.log(`⚠️ WARNING: No critical login files found! Session may not maintain login state.`);
      }
      
    return zipPath;
    } catch (error) {
      console.error(`?? Error creating zip: ${error.message}`);
      throw error;
    }
  };

  let zipPath;
  try {
    logger.log('?? Creating session zip (with enhanced locked file handling)...');
    zipPath = createZipSafely();

    const uploadRequest = await http.post(`/sessions/${sessionId}/request-upload`, {
      contentType: 'application/zip',
    });

    const { url: uploadUrl, bundleKey } = uploadRequest.data;
    logger.log(`?? Uploading session bundle: ${bundleKey}`);

    const zipBuffer = fs.readFileSync(zipPath);
    await axios.put(uploadUrl, zipBuffer, {
      headers: { 'Content-Type': 'application/zip' },
    });

    logger.log(`? Session uploaded successfully`);

    await http.post(`/sessions/${sessionId}/complete-upload`, {
      checksum: bundleKey,
      fileSizeBytes: zipBuffer.length,
    });

    return { bundleKey };
  } finally {
    if (zipPath && fs.existsSync(zipPath)) {
      try {
        fs.unlinkSync(zipPath);
      } catch (cleanupError) {
        logger.log(`?? Could not remove temp zip: ${cleanupError.message}`);
      }
    }
  }
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: BRAND_NAME,
    autoHideMenuBar: true,
    resizable: true,
    icon: resolveAppIcon(), // Use robust icon resolution
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // Explicitly set icon after window creation (critical for Windows)
  setWindowIcon(loginWindow);

  // Hide menu bar completely (same as DAT window)
  loginWindow.setMenuBarVisibility(false);
  loginWindow.setMenu(null);

  loginWindow.loadFile(resolvePublicPath('index.html'));
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

// Track proxy authentication attempts to prevent infinite loops
let proxyAuthAttempts = new Map();
const MAX_PROXY_AUTH_ATTEMPTS = 5;

app.on('login', (event, webContents, request, authInfo, callback) => {
  // Only log first few attempts to avoid spam
  const authKey = `${authInfo?.host || 'unknown'}:${authInfo?.port || 'unknown'}`;
  const attempts = proxyAuthAttempts.get(authKey) || 0;
  
  if (attempts < 3) {
    logger.log(`🔐 Login event triggered:`, {
    hasAuthInfo: !!authInfo,
    isProxy: authInfo?.isProxy,
    host: authInfo?.host,
      port: authInfo?.port,
    hasCredentials: hasProxyCredentials,
    username: PROXY_USERNAME ? '✅ Set' : '❌ Missing',
      password: PROXY_PASSWORD ? '✅ Set' : '❌ Missing',
      attempt: attempts + 1
  });
  }

  if (!authInfo || !authInfo.isProxy || !hasProxyCredentials) {
    if (attempts < 3) {
      logger.log(`⚠️ Skipping authentication:`, {
      reason: !authInfo ? 'No authInfo' : !authInfo.isProxy ? 'Not a proxy' : 'No credentials'
    });
    }
    return;
  }

  // Prevent infinite authentication loops
  if (attempts >= MAX_PROXY_AUTH_ATTEMPTS) {
    console.error(`❌ Too many proxy authentication attempts (${attempts}) for ${authKey}. Possible credential issue.`);
    if (attempts === MAX_PROXY_AUTH_ATTEMPTS) {
      dialog.showErrorBox(
        'Proxy Authentication Failed',
        `Unable to authenticate with proxy server after ${MAX_PROXY_AUTH_ATTEMPTS} attempts.\n\n` +
        `Proxy: ${authInfo.host}:${authInfo.port}\n\n` +
        `Please check:\n` +
        `1. Proxy credentials are correct\n` +
        `2. Proxy server is running\n` +
        `3. Proxy server allows connections from your IP`
      );
    }
    return;
  }

  proxyAuthAttempts.set(authKey, attempts + 1);

  event.preventDefault();
  if (attempts < 3) {
    logger.log(`✅ Providing proxy credentials for user: ${PROXY_USERNAME}`);
  }
  callback(PROXY_USERNAME, PROXY_PASSWORD);
  
  // Reset attempts after successful authentication (detected via successful page load)
  setTimeout(() => {
    if (webContents && !webContents.isDestroyed()) {
      const currentUrl = webContents.getURL();
      if (currentUrl && currentUrl.startsWith('https://')) {
        proxyAuthAttempts.delete(authKey);
      }
    }
  }, 10000); // Reset after 10 seconds if page loaded successfully
});

app.whenReady().then(() => {
  // Hide Electron indicators via command line (but keep security enabled)
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
  app.commandLine.appendSwitch('exclude-switches', 'enable-automation');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  // Remove disable-web-security to fix CSP issues
  // app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  
  // CRITICAL: Prevent file locking during session capture
  logger.log('🔧 Configuring Chromium to prevent file locking...');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-features', 'TranslateUI');
  app.commandLine.appendSwitch('disable-ipc-flooding-protection');
  app.commandLine.appendSwitch('disable-hang-monitor');
  app.commandLine.appendSwitch('disable-prompt-on-repost');
  app.commandLine.appendSwitch('disable-sync');
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
  app.commandLine.appendSwitch('disable-default-apps');
  app.commandLine.appendSwitch('disable-extensions');
  app.commandLine.appendSwitch('disable-plugins');
  app.commandLine.appendSwitch('disable-preconnect');
  app.commandLine.appendSwitch('disable-translate');
  app.commandLine.appendSwitch('disable-web-resources');
  app.commandLine.appendSwitch('aggressive-cache-discard');
  app.commandLine.appendSwitch('enable-aggressive-domstorage-flushing');
  app.commandLine.appendSwitch('force-effective-connection-type', '4g');
  
  // Use Squid proxy for IP masking
  const cloudProxyEnabled = process.env.CLOUD_PROXY_ENABLED === 'true';
  const cloudServerIP = process.env.CLOUD_SERVER_IP || '167.99.147.118';
  const proxyPort = process.env.CLOUD_PROXY_PORT || '3128'; // Squid default port
  
  if (cloudProxyEnabled) {
    // Set Squid proxy for ALL Electron sessions
    app.commandLine.appendSwitch('proxy-server', `http://${cloudServerIP}:${proxyPort}`);
    // Bypass proxy only for API server to avoid routing conflicts
    // DigitalOcean Spaces downloads will route through proxy (may provide better performance)
    // Note: Bypass list format: comma-separated list of hosts (no wildcards)
    app.commandLine.appendSwitch('proxy-bypass-list', `${cloudServerIP},localhost,127.0.0.1,<local>`);
    logger.log(`?? IP Masking Enabled via Squid Proxy: ${cloudServerIP}:${proxyPort}`);
    logger.log(`?? API calls bypass proxy, downloads route through proxy`);
  } else {
    logger.log(`?? IP Masking Disabled: Using local IP`);
  }
  
  createLoginWindow();
  
  // Initialize log file now that app is ready
  initializeLogFile();
  logger.log(`🚀 App started successfully`);
  logger.log(`📝 Log file location: ${logFile || 'Not initialized'}`);
  logger.log(`📁 Log directory: ${logDir || 'Not initialized'}`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function sendStatus(channel, payload) {
  if (loginWindow) {
    loginWindow.webContents.send(channel, payload);
  }
}

function setupHttp(authToken) {
  http = axios.create({
    baseURL: API_BASE_URL,
    timeout: 45000,
  });

  if (authToken) {
    http.defaults.headers.common.Authorization = `Bearer ${authToken}`;
  }
}

// Token refresh function - refreshes access token using refresh token
async function refreshAccessToken() {
  if (!tokens || !tokens.refreshToken) {
    logger.warn('⚠️ Cannot refresh token: No refresh token available');
    return null;
  }
  
  try {
    logger.log('🔄 Refreshing access token...');
    // Create a temporary http instance without auth header for refresh call
    const refreshHttp = axios.create({
      baseURL: API_BASE_URL,
      timeout: 45000,
    });
    
    const response = await refreshHttp.post('/auth/refresh', {
      refreshToken: tokens.refreshToken
    });
    
    // Debug: Log the actual response structure
    logger.log('🔍 Refresh response data:', JSON.stringify(response.data, null, 2));
    
    // Check for both possible formats (old and new)
    if (response.data && response.data.tokens) {
      // New format: { tokens: { accessToken, refreshToken } }
      tokens = response.data.tokens;
      setupHttp(tokens.accessToken);
      logger.log('✅ Access token refreshed successfully');
      return tokens.accessToken;
    } else if (response.data && response.data.accessToken && response.data.refreshToken) {
      // Old format: { accessToken, refreshToken } - fallback support
      logger.log('⚠️ Server returned old format, converting...');
      tokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken
      };
      setupHttp(tokens.accessToken);
      logger.log('✅ Access token refreshed successfully (old format)');
      return tokens.accessToken;
    } else {
      logger.error('❌ Token refresh failed: Invalid response format');
      logger.error('🔍 Response data keys:', Object.keys(response.data || {}));
      return null;
    }
  } catch (error) {
    logger.error('❌ Token refresh failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      logger.error('🔍 Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

ipcMain.handle('auth:login', async (_event, credentials) => {
  try {
    // Minimal status for production - only show essential info
    sendStatus('status:update', { type: 'info', message: 'Connecting...' });
    
    // Collect device information for session tracking
    const deviceInfo = await collectDeviceInfo();
    
    // Send credentials with device info
    const loginData = {
      ...credentials,
      macAddress: deviceInfo.macAddress,
      deviceMetadata: deviceInfo,
    };
    
    const response = await http.post('/auth/login', loginData);
    tokens = response.data.tokens;
    currentUser = response.data.user;
    setupHttp(tokens.accessToken);

    const sessionsResponse = await http.get('/sessions/my-sessions');
    const assignedSessions = Array.isArray(sessionsResponse.data) ? sessionsResponse.data : [];

    if (!assignedSessions.length) {
      sendStatus('status:update', {
        type: 'warning',
        message: 'No DAT session assigned to this account yet.',
      });
      return { user: currentUser, sessions: assignedSessions };
    }
      
    const session = assignedSessions[0];
    currentSessionId = session.id;
      
      // Check if this is a super admin - ALWAYS launch fresh to update session
      if (currentUser.role === 'SUPER_ADMIN') {
        sendStatus('status:update', { 
          type: 'info', 
        message: `Preparing DAT workspace...` 
        });
        
        try {
        // Launch fresh DAT session for super admin
          const launchResult = await launchFreshDatSession(session.domain?.baseUrl || DEFAULT_DAT_URL, session.id);
          
          // Check if launch was successful - only show error if there's an actual error message
          if (launchResult && launchResult.success === false && launchResult.error) {
            logger.error(`❌ Launch failed: ${launchResult.error}`);
            sendStatus('status:update', { 
              type: 'error', 
            message: `Failed to launch DAT workspace: ${launchResult.error}` 
            });
            // Login window should already be shown by launchFreshDatSession
            return { user: currentUser, sessions: assignedSessions };
          }
          
        // If session was just created, mark it as ready
          if (session.status === 'PENDING') {
            await markSharedSessionAsReady(session.id);
          }
          
        // Don't check visibility immediately - window needs time to initialize
        // Just wait a moment and force show the window
        if (datWindow && !datWindow.isDestroyed()) {
          // Wait for window to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          // Force show and ensure visibility
          datWindow.show();
          datWindow.setSkipTaskbar(false);
          datWindow.center();
          datWindow.focus();
          if (datWindow.isMinimized()) {
            datWindow.restore();
          }
          // Hide login window after ensuring DAT window is shown
        if (loginWindow) {
          loginWindow.hide();
          }
        } else {
          logger.warn(`⚠️ DAT window not created - keeping login window visible`);
          if (loginWindow) {
            loginWindow.show();
          }
        }
        } catch (launchError) {
          logger.error(`❌ Launch error caught: ${launchError.message}`);
          logger.error(`❌ Launch error stack:`, launchError.stack);
          sendStatus('status:update', { 
            type: 'error', 
          message: `Failed to launch DAT workspace: ${launchError.message}` 
          });
          // Show login window again - don't logout
          if (loginWindow) {
            loginWindow.show();
          }
          // Don't throw - return success with error info so user stays logged in
          return { user: currentUser, sessions: assignedSessions, launchError: launchError.message };
        }
      } else if (session.status === 'READY') {
        // Session is ready - auto-launch for all users
        sendStatus('status:update', { 
          type: 'info', 
          message: `Loading DAT One (estimated 30-60 seconds)` 
        });
        
        try {
          if (session.bundleKey) {
            // Session has bundle - use normal launch (for regular users with pre-loaded sessions)
            const launchResult = await launchSession(session.id, session.domain?.baseUrl || DEFAULT_DAT_URL);
            
            // Check if launch was successful - only show error if there's an actual error message
            if (launchResult && launchResult.success === false && launchResult.error) {
              logger.error(`❌ Launch failed: ${launchResult.error}`);
              sendStatus('status:update', { 
                type: 'error', 
              message: `Failed to launch DAT workspace: ${launchResult.error}` 
              });
              // Login window should already be shown by launchSession
              return { user: currentUser, sessions: assignedSessions };
            }
          } else {
            // Session is ready but no bundle - ONLY allow super admin to launch fresh
            if (currentUser.role === 'SUPER_ADMIN') {
            const launchResult = await launchFreshDatSession(session.domain?.baseUrl || DEFAULT_DAT_URL);
            
            // Check if launch was successful - only show error if there's an actual error message
            if (launchResult && launchResult.success === false && launchResult.error) {
              logger.error(`❌ Launch failed: ${launchResult.error}`);
              sendStatus('status:update', { 
                type: 'error', 
              message: `Failed to launch DAT workspace: ${launchResult.error}` 
              });
              // Login window should already be shown by launchFreshDatSession
              return { user: currentUser, sessions: assignedSessions };
            }
            } else {
              // Regular users cannot access fresh DAT login page - show access denied page
              const accessDeniedPath = resolvePublicPath('access-denied.html');
              if (loginWindow) {
                loginWindow.loadFile(accessDeniedPath);
                loginWindow.show();
              }
              sendStatus('status:update', { 
                type: 'info', 
                message: 'Please contact your service provider for access.' 
              });
              return { user: currentUser, sessions: assignedSessions };
            }
          }
          
        // Don't check visibility immediately - window needs time to initialize
        // Just wait a moment and force show the window
        if (datWindow && !datWindow.isDestroyed()) {
          // Wait for window to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          // Force show and ensure visibility
          datWindow.show();
          datWindow.setSkipTaskbar(false);
          datWindow.center();
          datWindow.focus();
          if (datWindow.isMinimized()) {
            datWindow.restore();
          }
          // Hide login window after ensuring DAT window is shown
        if (loginWindow) {
          loginWindow.hide();
          }
        } else {
          logger.warn(`⚠️ DAT window not created - keeping login window visible`);
          if (loginWindow) {
            loginWindow.show();
          }
        }
        } catch (launchError) {
          logger.error(`❌ Launch error caught: ${launchError.message}`);
          logger.error(`❌ Launch error stack:`, launchError.stack);
          sendStatus('status:update', { 
            type: 'error', 
          message: `Failed to launch DAT workspace: ${launchError.message}` 
          });
          // Show login window again - don't logout
          if (loginWindow) {
            loginWindow.show();
          }
          // Don't throw - return success with error info so user stays logged in
          return { user: currentUser, sessions: assignedSessions, launchError: launchError.message };
        }
      } else {
        // Session is pending but user is not super admin
        sendStatus('status:update', { 
        type: 'info', 
        message: `Session is being prepared. Please wait...` 
        });
    }

    return { user: currentUser, sessions: assignedSessions };
  } catch (error) {
    // Handle different error types with user-friendly messages
    const message = error.response?.data?.message || error.message || 'Invalid credentials';
    
    logger.error(`❌ Login handler error: ${message}`);
    logger.error(`❌ Login handler error stack:`, error.stack);
    
    // Check for session invalidation (logged in from another device)
    if (message.includes('Session invalidated') || message.includes('another device')) {
      sendStatus('status:update', { 
        type: 'warning', 
        message: 'You have been logged out because you logged in from another device.' 
      });
    } else if (message.includes('Invalid') || message.includes('Unauthorized') || message.includes('credentials')) {
      sendStatus('status:update', { type: 'error', message: 'Invalid email or password' });
    } else {
      // For launch errors, show specific message but don't logout
      if (message.includes('Failed to launch') || message.includes('DAT workspace')) {
        sendStatus('status:update', { type: 'error', message: message });
        // Don't throw - user stays logged in, can retry
        return { error: message };
      } else {
        sendStatus('status:update', { type: 'error', message: `Connection failed: ${message}` });
      }
    }
    
    // Only throw for actual authentication errors, not launch errors
    if (message.includes('Invalid') || message.includes('Unauthorized') || message.includes('credentials') || message.includes('Session invalidated')) {
    throw new Error(message);
    } else {
      // For other errors (like launch failures), return error but don't throw
      logger.warn(`⚠️ Non-critical error - keeping user logged in: ${message}`);
      return { error: message };
    }
  }
});

// Helper function to launch a session (used for auto-launch after login)
// Guard against concurrent launches
let isLaunchingSession = false;

async function launchSession(sessionId, datUrl) {
  // Guard against concurrent launches
  if (isLaunchingSession) {
    logger.log(`⚠️ Launch already in progress, skipping duplicate call`);
    // Return success since launch is already in progress - don't show error
    return { success: true, message: 'Launch already in progress' };
  }

  isLaunchingSession = true;
  
  try {
    // CRITICAL: Close existing DAT window before downloading/extracting to prevent file locking
    if (datWindow && !datWindow.isDestroyed()) {
      logger.log(`🔒 Closing existing DAT window to prevent file locking...`);
      
      // Close all tabs first to release file handles
      if (tabManager) {
        logger.log(`🔒 Closing all tabs before closing window...`);
        const tabIds = Array.from(tabManager.tabs.keys());
        for (const tabId of tabIds) {
          tabManager.closeTab(tabId);
        }
        // Wait for tabs to close
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      datWindow.removeAllListeners('closed');
      datWindow.once('closed', () => {
        logger.log(`✅ DAT window closed, file handles released`);
      });
      datWindow.close();
      
      // Wait for window to fully close and file handles to be released
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ensure datWindow reference is cleared
      datWindow = null;
      tabManager = null;
      
      // Additional wait for file handles to be fully released
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Always download fresh session from cloud to ensure latest data
    logger.log(`📥 Always downloading fresh session from cloud...`);
    
    // Retry logic for downloading fresh session ONLY (not for window launch errors)
    let downloadSuccess = false;
    let lastDownloadError = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.log(`🔄 Download attempt ${attempt}/${maxRetries}...`);
        
        // Download and restore session data using existing approach
        const sessionBundle = await downloadSessionBundle(sessionId);
        
        logger.log(`✅ Fresh session downloaded and extracted successfully!`);
        downloadSuccess = true;
        
        // Launch DAT window with the downloaded session data
        // Don't retry on window launch errors - they're handled separately
    await launchDatWindow(sessionBundle, datUrl);
        break;
        
      } catch (error) {
        // Check if this is a download error or a window launch error
        const errorMessage = error.message || '';
        const isDownloadError = errorMessage.includes('Download') || 
                                errorMessage.includes('download') ||
                                errorMessage.includes('network') ||
                                errorMessage.includes('timeout') ||
                                errorMessage.includes('ECONNREFUSED') ||
                                errorMessage.includes('ETIMEDOUT');
        
        const isWindowLaunchError = errorMessage.includes('handler') ||
                                   errorMessage.includes('tab:create') ||
                                   errorMessage.includes('Tab bar') ||
                                   errorMessage.includes('Window');
        
        if (isWindowLaunchError && downloadSuccess) {
          // If download succeeded but window launch failed, don't retry download
          // Re-throw the window launch error to be handled by outer catch
          throw error;
        }
        
        if (isDownloadError || !downloadSuccess) {
          // Only retry on download errors or if download hasn't succeeded yet
          lastDownloadError = error;
          logger.log(`❌ Download attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
            logger.log(`⏳ Waiting 5 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } else {
          // Window launch error after successful download - don't retry, throw it
          throw error;
        }
      }
    }
    
    if (!downloadSuccess) {
      throw new Error(`Failed to setup after ${maxRetries} attempts. Last error: ${lastDownloadError?.message}`);
    }

    // CRITICAL: Wait for datWindow to be created and ensure it's visible
    // The window should already be created by launchDatWindow, but we need to verify it's visible
    logger.log(`🔍 Checking DAT window visibility...`);
    let windowVisibleAttempts = 0;
    const maxVisibilityAttempts = 20; // Check for up to 10 seconds (20 * 500ms)
    
    while (windowVisibleAttempts < maxVisibilityAttempts) {
      if (datWindow && !datWindow.isDestroyed()) {
        // Force show the window multiple times
        datWindow.show();
        datWindow.center();
        datWindow.focus();
        
        // Check if minimized and restore
        if (datWindow.isMinimized()) {
          datWindow.restore();
        }
        
        // Check if window is actually visible
        if (datWindow.isVisible()) {
          logger.log(`✅ DAT window is visible (attempt ${windowVisibleAttempts + 1})`);
          break;
        } else {
          logger.warn(`⚠️ DAT window not visible yet (attempt ${windowVisibleAttempts + 1}/${maxVisibilityAttempts})`);
        }
      } else {
        logger.warn(`⚠️ DAT window not created yet (attempt ${windowVisibleAttempts + 1}/${maxVisibilityAttempts})`);
      }
      
      windowVisibleAttempts++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Final check - if window is visible, hide login window
    if (datWindow && !datWindow.isDestroyed() && datWindow.isVisible()) {
    if (loginWindow) {
      loginWindow.hide();
      }
      logger.log(`✅ Login window hidden, DAT window is visible`);
    } else {
      logger.error(`❌ DAT window failed to become visible after ${maxVisibilityAttempts} attempts`);
      logger.error(`❌ Window exists: ${datWindow ? 'yes' : 'no'}`);
      if (datWindow) {
        logger.error(`❌ Window destroyed: ${datWindow.isDestroyed()}`);
        logger.error(`❌ Window visible: ${datWindow.isVisible()}`);
        logger.error(`❌ Window minimized: ${datWindow.isMinimized()}`);
        // Force show one more time
        datWindow.show();
        datWindow.restore();
        datWindow.center();
        datWindow.focus();
      }
      // Keep login window visible so user can see error
      if (loginWindow) {
        loginWindow.show();
      }
    }

    return { success: true };
  } catch (error) {
    const message = error.message || 'Failed to launch session';
    logger.error(`❌ launchSession error: ${message}`);
    logger.error(`❌ launchSession error stack:`, error.stack);
    sendStatus('status:update', { type: 'error', message: `Failed to launch DAT workspace: ${message}` });
    // Show login window again on error - don't logout
    if (loginWindow) {
      loginWindow.show();
    }
    // Don't throw - return error instead to prevent logout
    return { success: false, error: message };
  } finally {
    // Always reset the flag
    isLaunchingSession = false;
  }
}

// Helper function to launch a fresh DAT session (for super admin setup)
async function launchFreshDatSession(datUrl, sessionId) {
  try {
    // SECURITY: Only super admins can launch fresh DAT sessions (which show login page)
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      console.error('❌ Access denied: Only super admins can launch fresh DAT sessions');
      // Show access denied page instead of error
      const accessDeniedPath = resolvePublicPath('access-denied.html');
      datWindow = new BrowserWindow({
        width: 600,
        height: 500,
        title: 'Access Restricted',
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
        icon: resolveAppIcon(), // Use robust icon resolution
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      // Explicitly set icon after window creation (critical for Windows)
      setWindowIcon(datWindow);
      datWindow.loadFile(accessDeniedPath);
      return { success: false, message: 'Access restricted' };
    }
    
    // For super admin, use session-specific partition so the capture matches what regular users will use
    const sessionInfo = sessionId ? {
      partition: `persist:session-${sessionId}`
    } : null;
    
    // Launch DAT window with session-specific partition for super admin
    await launchDatWindow(sessionInfo, datUrl);

    // CRITICAL: Wait for datWindow to be created and ensure it's visible
    logger.log(`🔍 Checking DAT window visibility...`);
    let windowVisibleAttempts = 0;
    const maxVisibilityAttempts = 20; // Check for up to 10 seconds (20 * 500ms)
    
    while (windowVisibleAttempts < maxVisibilityAttempts) {
      if (datWindow && !datWindow.isDestroyed()) {
        // Force show the window multiple times
        datWindow.show();
        datWindow.setSkipTaskbar(false); // Ensure taskbar visibility
        datWindow.center();
        datWindow.focus();
        
        // Check if minimized and restore
        if (datWindow.isMinimized()) {
          datWindow.restore();
        }
        
        // Check if window is actually visible
        if (datWindow.isVisible()) {
          logger.log(`✅ DAT window is visible (attempt ${windowVisibleAttempts + 1})`);
          break;
        } else {
          logger.warn(`⚠️ DAT window not visible yet (attempt ${windowVisibleAttempts + 1}/${maxVisibilityAttempts})`);
        }
      } else {
        logger.warn(`⚠️ DAT window not created yet (attempt ${windowVisibleAttempts + 1}/${maxVisibilityAttempts})`);
      }
      
      windowVisibleAttempts++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Final check - if window is visible, hide login window
    if (datWindow && !datWindow.isDestroyed() && datWindow.isVisible()) {
    if (loginWindow) {
      loginWindow.hide();
      }
      logger.log(`✅ Login window hidden, DAT window is visible`);
    } else {
      logger.error(`❌ DAT window failed to become visible after ${maxVisibilityAttempts} attempts`);
      logger.error(`❌ Window exists: ${datWindow ? 'yes' : 'no'}`);
      if (datWindow) {
        logger.error(`❌ Window destroyed: ${datWindow.isDestroyed()}`);
        logger.error(`❌ Window visible: ${datWindow.isVisible()}`);
        logger.error(`❌ Window minimized: ${datWindow.isMinimized()}`);
        // Force show one more time
        datWindow.show();
        datWindow.setSkipTaskbar(false);
        datWindow.restore();
        datWindow.center();
        datWindow.focus();
      }
      // Keep login window visible so user can see error
      if (loginWindow) {
        loginWindow.show();
      }
    }

    // If sessionId is provided (super admin), set up automatic session capture
    if (sessionId && currentUser?.role === 'SUPER_ADMIN') {
      setupSuperAdminSessionCapture(sessionId);
    }

    return { success: true };
  } catch (error) {
    const message = error.message || 'Failed to launch fresh DAT session';
    logger.error(`❌ launchFreshDatSession error: ${message}`);
    logger.error(`❌ launchFreshDatSession error stack:`, error.stack);
    sendStatus('status:update', { type: 'error', message: `Failed to launch DAT workspace: ${message}` });
    // Show login window again on error - don't logout
    if (loginWindow) {
      loginWindow.show();
    }
    // Don't throw - return error instead to prevent logout
    return { success: false, error: message };
  }
}

// Helper function to mark shared session as ready (super admin only)
async function markSharedSessionAsReady(sessionId) {
  try {
    const response = await http.post(`/sessions/${sessionId}/mark-ready`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to mark session as ready';
    throw new Error(message);
  }
}

// Setup automatic session capture for super admin
function setupSuperAdminSessionCapture(sessionId) {
  if (!datWindow) return;
  
  logger.log(`?? Setting up super admin session capture for session: ${sessionId}`);
  
  // Store the session ID globally
  currentSessionId = sessionId;
  
  // Listen for DAT page load completion
  datWindow.webContents.on('did-finish-load', async () => {
    const url = datWindow.webContents.getURL();
    logger.log(`?? DAT page loaded: ${url}`);
    
    // SECURITY: Block non-super-admin users from accessing DAT login page
    const isLoginPage = url.includes('/login') || url.includes('/u/login') || url.includes('/auth') || url.includes('/signin');
    if (isLoginPage && currentUser && currentUser.role !== 'SUPER_ADMIN') {
      console.error('❌ SECURITY: Non-super-admin user attempted to access DAT login page');
      
      // Redirect to access denied page instead of closing
      const accessDeniedPath = resolvePublicPath('access-denied.html');
      datWindow.webContents.loadFile(accessDeniedPath);
      
      return; // Stop further processing
    }
    
    // Verify proxy is being used for DAT page
    const cloudProxyEnabled = process.env.CLOUD_PROXY_ENABLED === 'true';
    if (cloudProxyEnabled) {
      const proxyServerIP = process.env.CLOUD_SERVER_IP || '167.99.147.118';
      const proxyPort = process.env.CLOUD_PROXY_PORT || '3128';
      logger.log(`🔍 Proxy Verification:`);
      logger.log(`   Proxy Status: ✅ ENABLED`);
      logger.log(`   Proxy Server: ${proxyServerIP}:${proxyPort}`);
      logger.log(`   All DAT traffic is routed through proxy`);
      
      // Additional verification: Check IP through proxy
      try {
        const response = await axios.get('http://httpbin.org/ip', {
          proxy: {
            host: proxyServerIP,
            port: parseInt(proxyPort, 10),
            auth: {
              username: PROXY_USERNAME,
              password: PROXY_PASSWORD
            }
          },
          timeout: 10000
        });
        
        const detectedIP = response.data.origin;
        logger.log(`   Your IP through proxy: ${detectedIP}`);
        
        if (detectedIP.includes(proxyServerIP)) {
          logger.log(`   ✅ CONFIRMED: DAT page is using proxy server IP!`);
        } else {
          logger.log(`   ⚠️  IP check shows: ${detectedIP} (may include client IP + proxy IP)`);
        }
      } catch (verifyError) {
        logger.log(`   ⚠️  Could not verify proxy IP: ${verifyError.message}`);
      }
    } else {
      logger.log(`⚠️  Proxy is DISABLED - using direct connection`);
    }
    
    // Check if user is logged into DAT (more comprehensive URL check)
    // Reuse isLoginPage from above (already declared)
    const isDatSite = url.includes('dat.com') || url.includes('datloadboard.com');
    
    if (isDatSite && !isLoginPage) {
      logger.log(`✅ Super admin logged into DAT successfully!`);
      logger.log(`📝 Note: Session will be captured using standalone script after closing the app`);
      logger.log(`🔄 Please close the app and run 'capture-session.bat' to upload the session`);
    } else {
      logger.log(`? Still on login page, waiting for user to login...`);
    }
  });
  
  // Also capture when window is closed - DISABLED: Using standalone script instead
  datWindow.on('close', () => {
    if (currentUser?.role === 'SUPER_ADMIN' && sessionId) {
      logger.log(`✅ DAT window closed for super admin`);
      logger.log(`📝 Note: Please run 'capture-session.bat' to upload the session to cloud`);
    }
  });
}

// Capture and upload super admin session
async function captureSuperAdminSession(sessionId) {
  try {
    logger.log(`?? Capturing super admin session: ${sessionId}`);
    sendStatus('status:update', { type: 'info', message: 'Saving session for all users...' });
    
    if (!datWindow) {
      logger.log('?? DAT window not available, skipping capture');
      return;
    }
    
    const session = datWindow.webContents.session;
    let partition = session.partition;
    
    logger.log(`?? Session partition value: "${partition}" (type: ${typeof partition})`);
    
    // If partition is undefined or empty, construct it from sessionId
    if (!partition || partition === '' || partition === 'undefined') {
      partition = `persist:session-${sessionId}`;
      logger.log(`?? Using constructed partition name: "${partition}"`);
    }
    
    // CRITICAL: Configure session to prevent file locking
    logger.log(`?? Configuring session to prevent file locking...`);
    
    // Set session preferences to minimize file locking
    session.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true); // Allow all permissions to prevent blocking
    });
    
    // Set aggressive cache limits to prevent file locking
    session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      return true; // Allow all permissions
    });
    
    // Configure session to minimize file operations
    session.webRequest.onBeforeRequest((details, callback) => {
      // Allow all requests to prevent blocking
      callback({ cancel: false });
    });
    
    // CRITICAL: Force flush all pending data to disk before zipping
    logger.log(`?? Flushing session data to disk...`);
    await session.flushStorageData();
    
    // Wait for flush to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear only non-critical caches to release file locks while preserving login data
    logger.log(`?? Clearing non-critical caches to release file locks...`);
    await session.clearCache();
    
    // Wait longer for the flush and cache clearing to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // CRITICAL: Additional aggressive flushing for Cookies file
    logger.log(`?? Performing aggressive session flushing for Cookies file...`);
    try {
      // Force close any open connections that might be locking the Cookies file
      await session.clearStorageData({
        storages: ['cookies', 'filesystems', 'indexdb', 'websql']
      });
      
      // Wait for storage clearing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force flush again after clearing
      await session.flushStorageData();
      
      // Final wait
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      logger.log(`?? Aggressive flushing completed`);
    } catch (error) {
      logger.log(`?? Aggressive flushing failed: ${error.message}`);
    }
    
    // Get the session data directory
    const userDataPath = app.getPath('userData');
    logger.log(`?? User data path: ${userDataPath}`);
    const sessionDataPath = path.join(userDataPath, 'Partitions', partition);
    
    logger.log(`?? Session data path: ${sessionDataPath}`);
    
    // CRITICAL: Verify critical directories exist before capturing
    logger.log(`?? Verifying critical directories exist...`);
    const criticalDirs = ['Network', 'Local Storage', 'Session Storage'];
    const missingDirs = [];
    
    for (const dir of criticalDirs) {
      const dirPath = path.join(sessionDataPath, dir);
      if (!fs.existsSync(dirPath)) {
        missingDirs.push(dir);
        logger.log(`?? WARNING: Critical directory missing: ${dir}`);
      } else {
        logger.log(`?? Critical directory found: ${dir}`);
        // List contents of critical directories
        try {
          const contents = fs.readdirSync(dirPath);
          logger.log(`?? Contents of ${dir}: ${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''} (${contents.length} items)`);
        } catch (err) {
          logger.log(`?? Could not read contents of ${dir}: ${err.message}`);
        }
      }
    }
    
    if (missingDirs.length > 0) {
      logger.log(`?? WARNING: Some critical directories are missing: ${missingDirs.join(', ')}`);
      logger.log(`?? This may indicate the session is not properly logged in`);
    }
    
    // Check if session directory exists
    if (!fs.existsSync(sessionDataPath)) {
      logger.log('?? Session data directory not found at expected path');
      logger.log(`?? Expected: ${sessionDataPath}`);
      
      // Check if partition exists anywhere in user data
      const partitionsDir = path.join(userDataPath, 'Partitions');
      logger.log(`?? Checking Partitions directory: ${partitionsDir}`);
      
      if (fs.existsSync(partitionsDir)) {
        const partitions = fs.readdirSync(partitionsDir);
        logger.log(`?? Found partitions: ${partitions.join(', ')}`);
        
        // Try to find a partition that matches our session ID
        const matchingPartition = partitions.find(p => p.includes(sessionId) || p.includes('session'));
        if (matchingPartition) {
          logger.log(`? Found matching partition: ${matchingPartition}`);
          const actualPath = path.join(partitionsDir, matchingPartition);
          logger.log(`?? Using actual path: ${actualPath}`);
          
          // Use the uploadSessionFromDirectory function which handles locked files
          await uploadSessionFromDirectory(actualPath, sessionId);
          
          sendStatus('status:update', { 
            type: 'success', 
            message: '? Session saved and shared with all users!' 
          });
          
          logger.log(`?? Super admin session captured and uploaded successfully`);
          return;
        }
      } else {
        logger.log('?? No Partitions directory exists yet');
      }
      
      logger.log('?? Session data not ready yet. Please browse DAT more and try again.');
      throw new Error('Session data directory not found. Please browse DAT for 1-2 minutes before saving.');
    }
    
    // Use the uploadSessionFromDirectory function which handles locked files
    await uploadSessionFromDirectory(sessionDataPath, sessionId);
    
    sendStatus('status:update', { 
      type: 'success', 
      message: '? Session saved and shared with all users!' 
    });
    
    logger.log(`?? Super admin session captured and uploaded successfully`);
  } catch (error) {
    console.error('? Failed to capture super admin session:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    
    let errorMessage = error.message || 'Session capture failed, but DAT is still accessible';
    if (error.message.includes('ENOENT')) {
      errorMessage = 'Session data directory not found. Please browse DAT for 1-2 minutes before saving.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Authentication error. Please check API credentials.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Cannot connect to server. Check network connection.';
    } else if (error.response?.data?.message) {
      errorMessage = `Upload failed: ${error.response.data.message}`;
    } else if (error.message.includes('Session data directory not found')) {
      errorMessage = 'Session data not ready. Please browse DAT for 1-2 minutes, then try saving again.';
    }
    
    sendStatus('status:update', { 
      type: 'warning', 
      message: errorMessage
    });
    
    // Re-throw the error with the actual message for the IPC handler
    throw new Error(errorMessage);
  }
}

async function downloadSessionBundle(sessionId) {
  try {
    logger.log(`🔄 Starting download process for session: ${sessionId}`);
    
    logger.log(`📡 Requesting download URL from API...`);
    const request = await http.post(`/sessions/${sessionId}/request-download`, {}, {
      timeout: 30000  // 30 second timeout for API request
    });
  const { url, bundleKey } = request.data;

  if (!url) {
    throw new Error('Download URL was not provided by the server.');
  }

    logger.log(`✅ Download URL received: ${url.substring(0, 50)}...`);

    // Don't send status message - button will show progress via download percentage
    logger.log(`📥 Downloading session bundle...`);
    logger.log(`🌐 Download URL: ${url.substring(0, 100)}...`);
    
    // Track download start time for progress logging
    const downloadStartTime = Date.now();
    
    // Use Node.js native https with HttpProxyAgent for proper CONNECT tunneling
    // This correctly handles HTTPS URLs through HTTP proxies
    const { HttpsProxyAgent } = require('https-proxy-agent');
    const https = require('https');
    
    const proxyUrl = process.env.CLOUD_PROXY_ENABLED === 'true' 
      ? `http://${hasProxyCredentials ? `${PROXY_USERNAME}:${PROXY_PASSWORD}@` : ''}${process.env.CLOUD_SERVER_IP || '167.99.147.118'}:${process.env.CLOUD_PROXY_PORT || '3128'}`
      : null;
    
    logger.log(`🚀 Downloading through proxy (may provide better routing)...`);
    if (proxyUrl) {
      logger.log(`🌐 Proxy URL: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`);
      logger.log(`🔐 Proxy auth: ${hasProxyCredentials ? 'configured' : 'none'}`);
    }
    
    // Parse the URL
    const urlObj = new URL(url);
    
    // Create proxy agent if proxy is enabled
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
    
    // Download using Node.js native https module with proxy agent
    const downloadPromise = new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        agent: agent,
        headers: {
          'User-Agent': 'DAT-Loadboard/1.0.0'
        }
      };
      
      const req = https.request(options, (res) => {
        const chunks = [];
        let totalSize = parseInt(res.headers['content-length'] || '0', 10);
        
        logger.log(`📥 Download started. Content-Length: ${totalSize > 0 ? Math.round(totalSize / 1024 / 1024) + 'MB' : 'Unknown'}`);
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          const downloaded = Buffer.concat(chunks).length;
          const downloadedMB = Math.round(downloaded / 1024 / 1024);
          const elapsed = Math.round((Date.now() - downloadStartTime) / 1000);
          const speedMBps = elapsed > 0 ? (downloadedMB / elapsed).toFixed(2) : '0';
          
          if (totalSize > 0) {
            const percentCompleted = Math.round((downloaded * 100) / totalSize);
            const totalMB = Math.round(totalSize / 1024 / 1024);
            logger.log(`📥 Download progress: ${percentCompleted}% (${downloadedMB}MB / ${totalMB}MB) - ${speedMBps} MB/s - ${elapsed}s elapsed`);
            // Send download progress to renderer for login button - format: "Loading DAT Workspace (%)"
            sendStatus('status:update', { type: 'download', percent: percentCompleted });
          } else {
            logger.log(`📥 Download progress: ${downloadedMB}MB downloaded - ${speedMBps} MB/s - ${elapsed}s elapsed`);
            // Estimate progress based on elapsed time for unknown size
            const estimatedPercent = Math.min(95, Math.round((elapsed / 300) * 100)); // Assume max 5 minutes
            sendStatus('status:update', { type: 'download', percent: estimatedPercent });
          }
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            data: buffer,
            status: res.statusCode,
            headers: res.headers
          });
        });
        
        res.on('error', (error) => {
          reject(error);
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      // Set timeout
      req.setTimeout(600000, () => {
        req.destroy();
        reject(new Error('Download timeout after 10 minutes'));
      });
      
      req.end();
    });
    
    const download = await downloadPromise;

    const downloadTime = Math.round((Date.now() - downloadStartTime) / 1000);
    const downloadSizeMB = Math.round(download.data.length / 1024 / 1024);
    const downloadSpeedMBps = downloadTime > 0 ? (downloadSizeMB / downloadTime).toFixed(2) : '0';
    logger.log(`✅ Session bundle downloaded (${download.data.length} bytes) in ${downloadTime} seconds`);
    logger.log(`📊 Download speed: ${downloadSpeedMBps} MB/s`);
    logger.log(`📊 Download size: ${downloadSizeMB} MB`);

  const tempZipPath = path.join(os.tmpdir(), `dslb-session-${sessionId}.zip`);
  fs.writeFileSync(tempZipPath, Buffer.from(download.data));
    logger.log(`💾 Session bundle saved to: ${tempZipPath}`);

  const userData = app.getPath('userData');
  const partitionsDir = path.join(userData, 'Partitions');
    // Electron maps persist:session-${sessionId} to session-${sessionId} directory internally
  const sessionPartitionDir = path.join(partitionsDir, `session-${sessionId}`);

    // AGGRESSIVE cleanup of old partition - remove ALL locked files
  if (fs.existsSync(sessionPartitionDir)) {
      logger.log(`🧹 AGGRESSIVE cleanup of old partition: ${sessionPartitionDir}`);
    
    // Strategy: Multiple cleanup attempts with different methods (no process killing)
    let cleanupSuccess = false;
    const cleanupMethods = [
      { name: 'Rename + Delete', method: () => {
        const tempPath = `${sessionPartitionDir}-temp-${Date.now()}`;
        fs.renameSync(sessionPartitionDir, tempPath);
        fs.rmSync(tempPath, { recursive: true, force: true });
      }},
      { name: 'Direct Force Delete', method: () => {
        fs.rmSync(sessionPartitionDir, { recursive: true, force: true });
      }},
      { name: 'Individual File Deletion', method: () => {
        const deleteRecursive = (dir) => {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const filePath = path.join(dir, file);
              try {
                if (fs.statSync(filePath).isDirectory()) {
                  deleteRecursive(filePath);
                } else {
                  fs.unlinkSync(filePath);
                }
          } catch (err) {
                logger.log(`⚠️ Could not delete ${filePath}: ${err.message}`);
              }
            }
            fs.rmdirSync(dir);
          }
        };
        deleteRecursive(sessionPartitionDir);
      }}
    ];
    
    for (const method of cleanupMethods) {
      try {
        logger.log(`🔄 Trying cleanup method: ${method.name}`);
        method.method();
        logger.log(`✅ Cleanup successful with method: ${method.name}`);
        cleanupSuccess = true;
        break;
      } catch (error) {
        logger.log(`❌ Cleanup method ${method.name} failed: ${error.message}`);
      }
    }
    
    if (!cleanupSuccess) {
      logger.log(`⚠️ All cleanup methods failed - proceeding with extraction anyway`);
    }
  }

  // Wait for file handles to be released after cleanup
  logger.log(`⏳ Waiting for file handles to be released...`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Verify temp file exists before using AdmZip
  if (!fs.existsSync(tempZipPath)) {
    throw new Error(`Temp zip file not found: ${tempZipPath}`);
  }
  
  const fileStats = fs.statSync(tempZipPath);
  if (fileStats.size === 0) {
    throw new Error(`Temp zip file is empty: ${tempZipPath}`);
  }
  
  logger.log(`✅ Temp zip file verified: ${fileStats.size} bytes`);
  
  const zip = new AdmZip(tempZipPath);
  const entries = zip.getEntries();
  const containsPartitions = entries.some((entry) => entry.entryName.startsWith('Partitions/'));

  logger.log(`?? Zip contains ${entries.length} entries`);
  logger.log(`?? Contains 'Partitions/' prefix: ${containsPartitions}`);

        // Extract files individually to handle locked files gracefully
    fs.mkdirSync(sessionPartitionDir, { recursive: true });
    logger.log(`?? Extracting to sessionPartitionDir: ${sessionPartitionDir}`);
        
        let extractedCount = 0;
        let skippedCount = 0;
        let criticalFilesExtracted = 0;
        
        for (const entry of entries) {
          try {
            // Extract ALL files - preserve directory structure
            zip.extractEntryTo(entry, sessionPartitionDir, true, true);
            extractedCount++;
            
            // Track critical files being extracted
            if (entry.entryName.includes('Network/') || 
                entry.entryName.includes('Local Storage/') ||
                entry.entryName.includes('Session Storage/') ||
                entry.entryName.includes('Preferences')) {
              criticalFilesExtracted++;
              logger.log(`?? Extracted critical file: ${entry.entryName}`);
            }
          } catch (error) {
            logger.log(`?? Failed to extract ${entry.entryName}: ${error.message}`);
            skippedCount++;
          }
        }
        
        logger.log(`?? Critical files extracted: ${criticalFilesExtracted}`);
  
  logger.log(`?? Extraction complete: ${extractedCount} files extracted (ALL FILES - complete session capture)`);
  
  // CRITICAL: Validate that all essential login files are present
  logger.log(`?? Validating session completeness...`);
  const validationResults = validateSessionCompleteness(sessionPartitionDir);
  if (!validationResults.isComplete) {
    logger.log(`?? WARNING: Session validation failed!`);
    logger.log(`?? Missing critical components: ${validationResults.missing.join(', ')}`);
  } else {
    logger.log(`?? Session validation passed! All critical components present.`);
  }

  // Check if critical login files were extracted
  logger.log(`?? Starting critical file check for ${sessionPartitionDir}`);
  logger.log(`?? DEBUG: About to check critical files...`);
  const criticalFiles = [
    { name: 'Network/Cookies', path: path.join(sessionPartitionDir, 'Network', 'Cookies') },
    { name: 'Local Storage/leveldb', path: path.join(sessionPartitionDir, 'Local Storage', 'leveldb') },
    { name: 'Session Storage', path: path.join(sessionPartitionDir, 'Session Storage') },
    { name: 'Preferences', path: path.join(sessionPartitionDir, 'Preferences') }
  ];
  
  logger.log(`?? Checking ${criticalFiles.length} critical files`);
  criticalFiles.forEach((criticalFile, index) => {
    try {
      logger.log(`?? Processing critical file ${index + 1}/${criticalFiles.length}: ${criticalFile.name}`);
      logger.log(`?? Checking path: ${criticalFile.path}`);
      if (fs.existsSync(criticalFile.path)) {
        logger.log(`?? Critical login file found: ${criticalFile.name}`);
      } else {
        logger.log(`?? WARNING: Critical login file missing: ${criticalFile.name}`);
        // Check if the directory exists
        const dirPath = path.dirname(criticalFile.path);
        if (fs.existsSync(dirPath)) {
          logger.log(`?? Directory exists: ${dirPath}`);
          const files = fs.readdirSync(dirPath);
          logger.log(`?? Files in directory: ${files.join(', ')}`);
        } else {
          logger.log(`?? Directory missing: ${dirPath}`);
        }
      }
    } catch (error) {
      logger.log(`?? ERROR processing critical file ${criticalFile.name}: ${error.message}`);
    }
  });

  fs.unlinkSync(tempZipPath);

  logger.log(`✅ Download and extraction completed successfully!`);
  return {
    bundleKey,
    partition: `persist:session-${sessionId}`,
  };
  
  } catch (error) {
    console.error(`❌ Download failed: ${error.message}`);
    console.error(`📋 Error details:`, error);
    
    // Clean up temp file if it exists
    const tempZipPath = path.join(os.tmpdir(), `dslb-session-${sessionId}.zip`);
    if (fs.existsSync(tempZipPath)) {
      try {
        fs.unlinkSync(tempZipPath);
        logger.log(`🧹 Cleaned up temp file: ${tempZipPath}`);
      } catch (cleanupError) {
        logger.log(`⚠️ Could not clean up temp file: ${cleanupError.message}`);
      }
    }
    
    // Re-throw the error so the retry logic can handle it
    throw error;
  }
}

async function launchDatWindow(sessionInfo, datUrl) {
  try {
  // Prevent duplicate windows - if DAT window already exists, focus it
  if (datWindow && !datWindow.isDestroyed()) {
      logger.log(`?? DAT window already exists, focusing on it...`);
    datWindow.focus();
      datWindow.show();
    return;
  }
    
    // SECURITY: Block non-super-admin users from accessing DAT login page
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      // Regular users should only use pre-loaded sessions (with bundle)
      // If they're trying to launch a fresh window, redirect to access denied page
      if (!sessionInfo || typeof sessionInfo === 'string' || !sessionInfo.partition) {
        console.error('❌ Access denied: Regular users cannot access DAT login page');
        const accessDeniedPath = resolvePublicPath('access-denied.html');
        datWindow = new BrowserWindow({
          width: 600,
          height: 500,
          title: 'Access Restricted',
          backgroundColor: '#ffffff',
          autoHideMenuBar: true,
          icon: resolveAppIcon(), // Use robust icon resolution
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        // Explicitly set icon after window creation (critical for Windows)
        setWindowIcon(datWindow);
        datWindow.loadFile(accessDeniedPath);
        datWindow.show();
        datWindow.center();
        return;
      }
    }
  
  const partitionName = sessionInfo?.partition || 'persist:dslb-session';
  // Ensure we always use search-loads URL for the first tab
  let targetUrl = datUrl || DEFAULT_DAT_URL;
  // If URL is just the base domain without a path, append /search-loads
  if (targetUrl === 'https://one.dat.com' || targetUrl === 'http://one.dat.com') {
    targetUrl = 'https://one.dat.com/search-loads';
  }
  
    logger.log(`?? Launching DAT window with partition: "${partitionName}"`);
    logger.log(`?? Target URL: "${targetUrl}"`);
  
  // Squid proxy is set globally, no need for per-window config
  const cloudProxyEnabled = process.env.CLOUD_PROXY_ENABLED === 'true';
  if (cloudProxyEnabled) {
      logger.log(`?? DAT window will route through Squid proxy (global setting)`);
  }

    // Track load retries for this window instance
    let loadRetryCount = 0;
    const maxLoadRetries = 3;
    let loadTimeout = null;

    logger.log(`🔄 Creating DAT BrowserWindow...`);
  datWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'DAT One',
      backgroundColor: '#1e1e1e', // Match tab bar background
    autoHideMenuBar: true,
      frame: false, // Remove native title bar to eliminate blue space
      titleBarStyle: 'hidden', // For macOS
      icon: resolveAppIcon(), // Use robust icon resolution
      show: true, // CRITICAL: Show window immediately instead of waiting
      skipTaskbar: false, // CRITICAL: Ensure window appears in taskbar
    webPreferences: {
        preload: path.join(__dirname, '../preload/tabBarPreload.js'), // New preload for tab bar
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
        // Don't use a partition for the main window - it's just for the tab bar
      backgroundThrottling: false,
      offscreen: false,
      webSecurity: true,
      allowDisplayingInsecureContent: false,
        enableWebSQL: false,
      disableBlinkFeatures: 'AutomationControlled,TranslateUI',
    },
  });
    
    logger.log(`✅ DAT BrowserWindow created successfully`);
    
    // Explicitly set icon after window creation (critical for Windows)
    setWindowIcon(datWindow);
    
    // CRITICAL: Immediately ensure window is visible, in taskbar, and not minimized
    datWindow.show();
    datWindow.setSkipTaskbar(false); // Force taskbar visibility
    datWindow.center();
    datWindow.focus();
    
    // Restore if minimized
    if (datWindow.isMinimized()) {
      datWindow.restore();
    }
    
    logger.log(`✅ DAT window shown immediately after creation`);
    logger.log(`✅ Window visible: ${datWindow.isVisible()}`);
    logger.log(`✅ Window minimized: ${datWindow.isMinimized()}`);
    logger.log(`✅ Window skipTaskbar: ${datWindow.isAlwaysOnTop()}`);
  
  // Log where session data will be stored
  const userData = app.getPath('userData');
  // Electron maps persist:session-${sessionId} to session-${sessionId} directory internally
  const actualPartitionPath = path.join(userData, 'Partitions', partitionName.replace('persist:', ''));
    logger.log(`?? Expected partition path: ${actualPartitionPath}`);

    // Hide menu bar completely
    datWindow.setMenuBarVisibility(false);
    datWindow.setMenu(null);
    
    // CRITICAL: Show window IMMEDIATELY - don't wait for tab bar to load
    // This ensures the window is visible even if tab bar loading fails
    logger.log(`🔄 Showing DAT window immediately...`);
    datWindow.show();
    datWindow.center();
    datWindow.focus();
    logger.log(`✅ DAT window shown immediately`);
    
    // Load the tab bar HTML first
    const tabBarPath = resolvePublicPath('tab-bar.html');
    logger.log(`📄 Loading tab bar from: ${tabBarPath}`);
  
    // Check if file exists before loading
    if (!fs.existsSync(tabBarPath)) {
      logger.error(`❌ Tab bar file not found at: ${tabBarPath}`);
      // Show error in window but keep window visible
      datWindow.webContents.loadURL(`data:text/html,<html><body style="padding: 40px; text-align: center; font-family: Arial; color: #fff; background: #1e1e1e; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1 style="color: #ff4444;">⚠️ Error</h1><p>Tab bar file not found: ${tabBarPath}</p><p style="font-size: 12px; opacity: 0.7;">Please check installation.</p></body></html>`);
      throw new Error(`Tab bar file not found: ${tabBarPath}`);
    }
    
    // Load tab bar with error handling
    datWindow.loadFile(tabBarPath).catch(err => {
      logger.error(`❌ Failed to load tab bar: ${err.message}`);
      logger.error(`❌ Tab bar load error stack:`, err.stack);
      // Show error in window but keep window visible
      datWindow.webContents.loadURL(`data:text/html,<html><body style="padding: 40px; text-align: center; font-family: Arial; color: #fff; background: #1e1e1e; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1 style="color: #ff4444;">⚠️ Error Loading Tab Bar</h1><p>${err.message}</p><p style="font-size: 12px; opacity: 0.7;">Please check console logs.</p></body></html>`);
      // Don't throw - keep window visible for debugging
      logger.error(`⚠️ Continuing despite tab bar load error - window should be visible`);
    });
    
    // Wait for tab bar to load, then ensure window is still visible
    datWindow.webContents.once('did-finish-load', () => {
      logger.log(`✅ Tab bar loaded, ensuring DAT window is visible...`);
      datWindow.show();
      datWindow.center();
      datWindow.focus();
      logger.log(`✅ DAT window visibility confirmed`);
    });
    
    // Multiple fallback mechanisms to ensure window is visible
    const showWindowFallbacks = [
      () => setTimeout(() => {
        if (datWindow && !datWindow.isDestroyed() && !datWindow.isVisible()) {
          logger.log(`⚠️ Fallback 1: Window not visible, forcing show...`);
          datWindow.show();
          datWindow.center();
          datWindow.focus();
        }
      }, 1000),
      () => setTimeout(() => {
        if (datWindow && !datWindow.isDestroyed() && !datWindow.isVisible()) {
          logger.log(`⚠️ Fallback 2: Window still not visible, forcing show again...`);
          datWindow.show();
          datWindow.center();
          datWindow.focus();
        }
      }, 3000),
      () => setTimeout(() => {
        if (datWindow && !datWindow.isDestroyed() && !datWindow.isVisible()) {
          logger.log(`⚠️ Fallback 3: Final attempt to show window...`);
          datWindow.show();
          datWindow.center();
          datWindow.focus();
          // Also check if window is minimized
          if (datWindow.isMinimized()) {
            datWindow.restore();
          }
        }
      }, 5000)
    ];
    
    showWindowFallbacks.forEach(fallback => fallback());

    // Initialize tab manager with user role check function
    logger.log(`🔄 Initializing TabManager...`);
    tabManager = new TabManager(datWindow, 
      () => currentUser?.role || null, // Function to get current user role
      () => resolvePublicPath('access-denied.html') // Function to get access denied page path
    );
    logger.log(`✅ TabManager initialized`);

    // Handle window resize for tabs
    datWindow.on('resize', () => {
      if (tabManager) {
        tabManager.handleResize();
      }
    });

    // Create first tab with the session
    let firstTabId;
    try {
      logger.log(`🔄 Creating first tab with partition: "${partitionName}" and URL: "${targetUrl}"`);
      firstTabId = tabManager.createTab(sessionInfo, targetUrl);
      logger.log(`✅ First tab created successfully with ID: ${firstTabId}`);
    } catch (tabError) {
      logger.error(`❌ Failed to create first tab: ${tabError.message}`);
      logger.error(`❌ Tab creation error stack:`, tabError.stack);
      // Show error to user
      datWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="padding: 40px; text-align: center; font-family: Arial; color: #fff; background: #1e1e1e; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h1 style="color: #ff4444;">⚠️ Error Loading DAT Workspace</h1>
          <p style="font-size: 16px; margin-top: 20px;">${tabError.message}</p>
          <p style="font-size: 14px; margin-top: 10px; opacity: 0.7;">Please check the console logs for more details.</p>
        </div>';
      `).catch(err => logger.error('Failed to show error message:', err));
      // Still show the window even if tab creation failed
      datWindow.show();
      datWindow.center();
      throw tabError;
    }
  
  // Setup IPC handlers for tab management
  setupTabBarIPC(tabManager);
    
  // Setup tab bar update listener in main window (tab bar is now hardcoded in window frame)
  datWindow.webContents.on('did-finish-load', () => {
    logger.log(`✅ Tab bar HTML finished loading`);
    // Set up IPC listener in tab bar HTML
    datWindow.webContents.executeJavaScript(`
      if (window.dslbSession && window.dslbSession.onTabsUpdate) {
        window.dslbSession.onTabsUpdate((tabsData) => {
          if (window.dslbTabManager) {
            window.dslbTabManager.updateTabs(tabsData);
          }
        });
      }
    `).catch(err => {
      logger.error('Failed to set up tab update listener:', err);
    });
    
    // Initial update
    if (tabManager) {
      tabManager.updateTabBar();
    }
  });
  
  // Setup navigation hiding for tabs (but not tab bar injection - tab bar is in main window now)
  function setupTabNavigationHiding(tabId) {
    const tab = tabManager.tabs.get(tabId);
    if (!tab || !tab.view || !tab.view.webContents) return;
    
    // Only inject navigation hiding, not tab bar (tab bar is in main window now)
    tab.view.webContents.once('dom-ready', () => {
      // Store timeout ID so we can clear it if tab is destroyed
      const timeoutId = setTimeout(() => {
        // Double-check tab still exists and webContents is valid before injecting
        const currentTab = tabManager.tabs.get(tabId);
        if (currentTab && currentTab.view && currentTab.view.webContents && !currentTab.view.webContents.isDestroyed()) {
          injectDATNavigationHiding(currentTab.view.webContents);
          }
      }, 500);
      
      // Store timeout ID in tab info for cleanup
      if (tab) {
        tab.navigationHidingTimeout = timeoutId;
      }
    });
  }
  
  
  // Setup navigation hiding for first tab (tab bar is now in main window, not injected)
  setupTabNavigationHiding(firstTabId);

  // Monkey-patch createTab to setup navigation hiding for new tabs
  const originalCreateTab = tabManager.createTab.bind(tabManager);
  tabManager.createTab = function(sessionInfo, datUrl, isLoading) {
    const tabId = originalCreateTab(sessionInfo, datUrl, isLoading);
    setupTabNavigationHiding(tabId);
    return tabId;
  };

  // Enhanced User-Agent is set in TabManager
  
  // Set Content Security Policy to fix security warning (without unsafe-eval)
  datWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Only apply CSP to HTML pages, not to all resources
    if (details.responseHeaders['content-type'] && 
        details.responseHeaders['content-type'][0]?.includes('text/html')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' https:; " +
            "script-src 'self' 'unsafe-inline' https:; " +
            "style-src 'self' 'unsafe-inline' https:; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' https:; " +
            "frame-src 'self' https:; " +
            "font-src 'self' data: https:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self' https:;"
          ]
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
    
  // Note: Proxy is already configured globally via app.commandLine.appendSwitch
  // No need to set session-specific proxy as it conflicts with global settings
  
  // Hide Electron indicators
    datWindow.webContents.executeJavaScript(`
    // Remove Electron indicators
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
      
    // Override chrome runtime
    if (window.chrome && window.chrome.runtime) {
      Object.defineProperty(window.chrome.runtime, 'onConnect', {
        get: () => undefined,
      });
    }
    
    // Remove electron indicators
    delete window.require;
    delete window.exports;
    delete window.module;
  `);

  // Window closed handler
  datWindow.on('closed', () => {
    logger.log(`📱 DAT window closed`);
    // Clean up tab manager before quitting
    if (tabManager) {
      try {
        tabManager.destroy();
      } catch (err) {
        logger.error('Error destroying tab manager:', err);
      }
    }
    tabManager = null;
    datWindow = null;
    
    // Only quit if logout was NOT intentional (user manually closed window)
    // If logout was intentional, login window should already be showing
    if (!isIntentionalLogout) {
      // Close the entire app when DAT window is manually closed
      logger.log('📱 DAT window manually closed - quitting app');
      app.quit();
    } else {
      // Intentional logout - don't quit, login window should be visible
      logger.log('📱 Intentional logout - keeping app open');
      isIntentionalLogout = false; // Reset flag
    }
  });
  
  // Also handle 'close' event to clean up before window is destroyed
  datWindow.on('close', (event) => {
    logger.log(`📱 DAT window close event triggered`);
    // Clean up tab manager before window closes
    if (tabManager) {
      try {
        tabManager.destroy();
      } catch (err) {
        logger.error('Error destroying tab manager on close:', err);
            }
      tabManager = null;
    }
    // Don't prevent default - allow window to close
  });
  
  // Increase max listeners to avoid warning (allows for multiple tabs)
  datWindow.setMaxListeners(100);
  
  logger.log(`✅ DAT window launch completed successfully`);
          } catch (error) {
    logger.error(`❌ CRITICAL ERROR in launchDatWindow: ${error.message}`);
    logger.error(`❌ Error stack:`, error.stack);
    
    // CRITICAL: Ensure window is shown even if there's an error
    if (datWindow && !datWindow.isDestroyed()) {
      logger.log(`🔄 Attempting to show window despite error...`);
      datWindow.show();
      datWindow.center();
      datWindow.focus();
  
      // Check if window is minimized and restore it
      if (datWindow.isMinimized()) {
        datWindow.restore();
      }
      
      // Show error message in window
      datWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="padding: 40px; text-align: center; font-family: Arial; color: #fff; background: #1e1e1e; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h1 style="color: #ff4444;">⚠️ Error Loading DAT Workspace</h1>
          <p style="font-size: 16px; margin-top: 20px;">${error.message}</p>
          <p style="font-size: 14px; margin-top: 10px; opacity: 0.7;">Please check the console logs for more details.</p>
          <p style="font-size: 12px; margin-top: 20px; opacity: 0.5;">Error: ${error.stack}</p>
        </div>';
      `).catch(err => {
        logger.error('Failed to show error message:', err);
        // Fallback: Load error page directly
        datWindow.webContents.loadURL(`data:text/html,<html><body style="padding: 40px; text-align: center; font-family: Arial; color: #fff; background: #1e1e1e; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1 style="color: #ff4444;">⚠️ Error Loading DAT Workspace</h1><p>${error.message}</p><p style="font-size: 12px; opacity: 0.7;">Please check console logs.</p></body></html>`);
      });
      
      logger.log(`✅ Window should now be visible with error message`);
    } else {
      // If window creation failed, create a simple error window
      logger.error(`❌ DAT window creation failed completely - creating error window`);
      try {
        const errorWindow = new BrowserWindow({
          width: 600,
          height: 400,
          title: 'Error',
          backgroundColor: '#1e1e1e',
          autoHideMenuBar: true,
          icon: resolveAppIcon(), // Use robust icon resolution
          show: true, // Show immediately
        });
        // Explicitly set icon after window creation (critical for Windows)
        setWindowIcon(errorWindow);
        errorWindow.loadURL(`data:text/html,<html><body style="padding: 40px; text-align: center; font-family: Arial; color: #fff; background: #1e1e1e; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1 style="color: #ff4444;">⚠️ Error Loading DAT Workspace</h1><p>${error.message}</p><p style="font-size: 12px; opacity: 0.7;">Please check the console logs.</p></body></html>`);
        errorWindow.show();
        errorWindow.center();
        errorWindow.focus();
        logger.log(`✅ Error window created and shown`);
      } catch (winError) {
        logger.error(`❌ Failed to create error window: ${winError.message}`);
      }
    }
    
    throw error; // Re-throw to let caller handle it
  }
  
  // All old datWindow.webContents event handlers removed - BrowserViews handle their own events
  // Navigation errors, page loads, and button injection are handled in TabManager for each BrowserView
}

// Function to launch a new DAT window (for plus button)
async function launchNewDatWindow(sessionId, datUrl) {
  const partitionName = `persist:session-${sessionId}`;
  const targetUrl = datUrl || DEFAULT_DAT_URL;
  
  logger.log(`🔧 Launching new DAT window with partition: "${partitionName}"`);
  
  // Create new DAT window
  const newDatWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'DAT One',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    icon: resolveAppIcon(), // Use robust icon resolution
    webPreferences: {
      preload: path.join(__dirname, '../preload/sessionPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      partition: partitionName,
      // CRITICAL: Prevent file locking during session operations
      backgroundThrottling: false,
      offscreen: false,
      webSecurity: true,
      allowDisplayingInsecureContent: false,
      enableWebSQL: true,
      // Removed enableBlinkFeatures to avoid security warning (not needed for functionality)
      disableBlinkFeatures: 'AutomationControlled,TranslateUI',
    },
  });
  
  // Explicitly set icon after window creation (critical for Windows)
  setWindowIcon(newDatWindow);
  
  // Enhanced User-Agent to avoid Electron detection
  newDatWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  
  // Set Content Security Policy to fix security warning (without unsafe-eval)
  newDatWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Only apply CSP to HTML pages, not to all resources
    if (details.responseHeaders['content-type'] && 
        details.responseHeaders['content-type'][0]?.includes('text/html')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' https:; " +
            "script-src 'self' 'unsafe-inline' https:; " +
            "style-src 'self' 'unsafe-inline' https:; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' https:; " +
            "frame-src 'self' https:; " +
            "font-src 'self' data: https:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self' https:;"
          ]
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
  
  // Hide Electron indicators
  newDatWindow.webContents.executeJavaScript(`
    // Remove Electron indicators
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Override chrome runtime
    if (window.chrome && window.chrome.runtime) {
      Object.defineProperty(window.chrome.runtime, 'onConnect', {
        get: () => undefined,
      });
    }
    
    // Remove electron indicators
    delete window.require;
    delete window.exports;
    delete window.module;
  `);

  // Hide DAT navigation buttons (Notification, Support, My Account) and prewarn dialog
  newDatWindow.webContents.on('did-finish-load', () => {
    logger.log('🔧 Hiding DAT navigation buttons in new window...');
    
    // Inject CSS to hide specific navigation elements and prewarn dialog
    newDatWindow.webContents.insertCSS(`
      /* Hide Notifications button */
      .nav-notification-inbox {
        display: none !important;
      }
      
      /* Hide Support expansion panel */
      .nav-expansion-panel:has(mat-icon[data-mat-icon-name="support"]) {
        display: none !important;
      }
      
      /* Hide My Account expansion panel */
      .nav-expansion-panel:has(mat-expansion-panel-header[data-test="profile-nav"]) {
        display: none !important;
      }
      
      /* Hide the "logged in on another device" prewarn dialog */
      dat-prewarn-dialog-component,
      mat-dialog-container:has(dat-prewarn-dialog-component) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Hide only the overlay pane containing the prewarn dialog - NOT the entire container */
      .cdk-overlay-pane:has(dat-prewarn-dialog-component) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Hide the global wrapper containing the prewarn dialog */
      .cdk-global-overlay-wrapper:has(dat-prewarn-dialog-component) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Hide only the backdrop when prewarn dialog is shown - use child selector to not hide other overlays */
      .cdk-overlay-container:has(dat-prewarn-dialog-component) > .cdk-overlay-backdrop {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `);
    
    // JavaScript fallback for browsers that don't support :has() selector
    newDatWindow.webContents.executeJavaScript(`
      function hideDATNavigationButtons() {
        // Hide Notifications button
        const notificationInbox = document.querySelector('.nav-notification-inbox');
        if (notificationInbox) {
          notificationInbox.style.display = 'none';
          console.log('🔧 Hidden Notifications button');
        }
        
        // Hide Support panel by finding the support icon and hiding its parent panel
        const supportIcon = document.querySelector('mat-icon[data-mat-icon-name="support"]');
        if (supportIcon) {
          const supportPanel = supportIcon.closest('mat-expansion-panel');
          if (supportPanel) {
            supportPanel.style.display = 'none';
            console.log('🔧 Hidden Support panel');
          }
        }
        
        // Hide My Account panel by finding the profile nav header and hiding its parent panel
        const accountHeader = document.querySelector('mat-expansion-panel-header[data-test="profile-nav"]');
        if (accountHeader) {
          const accountPanel = accountHeader.closest('mat-expansion-panel');
          if (accountPanel) {
            accountPanel.style.display = 'none';
            console.log('🔧 Hidden My Account panel');
          }
        }
      }
      
      // Run immediately
      hideDATNavigationButtons();
      
      // Run again after delays to catch dynamically loaded elements
      setTimeout(hideDATNavigationButtons, 1000);
      setTimeout(hideDATNavigationButtons, 3000);
      
      // Watch for DOM changes and re-hide elements if they reappear
      (function() {
        const navObserver = new MutationObserver(() => {
          setTimeout(hideDATNavigationButtons, 100);
        });
        navObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      })();
    `);
  });

  newDatWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://')) {
      event.preventDefault();
      dialog.showErrorBox('Navigation blocked', 'Blocked navigation to unsafe URL: ' + url);
    }
  });

  newDatWindow.on('closed', () => {
    logger.log('🔧 New DAT window closed');
  });

  // Load the URL
  await newDatWindow.loadURL(targetUrl);
  
  logger.log('✅ New DAT window created successfully');
}

ipcMain.handle('session:launch', async (_event, payload) => {
  try {
    const { sessionId, datUrl } = payload || {};
    if (!sessionId) {
      throw new Error('Session ID is required.');
    }

    sendStatus('status:update', { type: 'info', message: 'Launching DAT session…' });
    const bundle = await downloadSessionBundle(sessionId);
    await launchDatWindow(bundle, datUrl);

    if (loginWindow) {
      loginWindow.hide();
    }

    return { success: true };
  } catch (error) {
    const message = error.message || 'Failed to launch session';
    sendStatus('status:update', { type: 'error', message });
    throw new Error(message);
  }
});

ipcMain.handle('test:ip', async () => {
  try {
    // Squid proxy is set globally, just open the window
    const ipTestWindow = new BrowserWindow({
      width: 900,
      height: 700,
      title: 'IP Check - DAT One',
      autoHideMenuBar: true,
    });
    
    logger.log(`?? IP Test Window - Using global Squid proxy`);
    
    // Load IP check website
    await ipTestWindow.loadURL('https://whatismyipaddress.com/');
    
    return { success: true };
  } catch (error) {
    console.error('Failed to open IP test window:', error);
    throw new Error('Failed to open IP check: ' + error.message);
  }
});

// IPC handler for creating new DAT windows
ipcMain.handle('dat:new-window', async () => {
  try {
    logger.log('🔧 Creating new tab...');
    
    // CRITICAL: Ensure login window is hidden FIRST before any other operations
    if (loginWindow && loginWindow.isVisible()) {
      loginWindow.hide();
    }
    
    // CRITICAL: Ensure DAT window exists and is visible
    if (!datWindow || datWindow.isDestroyed()) {
      throw new Error('DAT window not available');
    }
    
    // Ensure DAT window is visible and focused BEFORE creating tab
    if (!datWindow.isVisible()) {
      datWindow.show();
    }
    datWindow.focus();
    
    const datUrl = DEFAULT_DAT_URL;
    
    // Try to get session info from active tab first (no server call needed - instant)
    let sessionInfo = null;
    
    if (tabManager && tabManager.activeTabId) {
      const activeTab = tabManager.tabs.get(tabManager.activeTabId);
      if (activeTab && activeTab.sessionInfo) {
        // Reuse session info from active tab (instant, no server call)
        sessionInfo = {
          partition: activeTab.sessionInfo.partition || activeTab.partitionName,
          sessionId: activeTab.sessionInfo.sessionId || currentSessionId,
        };
        logger.log(`✅ Reusing session from active tab: ${sessionInfo.partition}`);
      }
    }
    
    // Fallback: use current session ID without server call (instant)
    if (!sessionInfo && currentSessionId) {
      sessionInfo = {
        partition: `persist:session-${currentSessionId}`,
        sessionId: currentSessionId,
      };
      logger.log(`✅ Using current session partition: ${sessionInfo.partition}`);
    }
    
    // Last resort: create a generic partition (instant)
    if (!sessionInfo) {
      sessionInfo = {
        partition: 'persist:dslb-session',
        sessionId: null,
      };
      logger.log(`⚠️ Using default partition: ${sessionInfo.partition}`);
    }
    
    // Create new tab immediately (synchronous operation)
    if (tabManager) {
      // Mark tab as loading immediately
      const newTabId = tabManager.createTab(sessionInfo, datUrl, true); // true = loading state
      logger.log(`✅ New tab created: ${newTabId}`);
      
      // Update tab bar immediately to show loading state
      tabManager.updateTabBar();
      
      return { success: true, tabId: newTabId };
    } else {
      throw new Error('Tab manager not available');
    }
  } catch (error) {
    logger.error('Failed to create new tab:', error);
    throw new Error('Failed to create new tab: ' + error.message);
  }
});

// Tab management IPC handlers
function setupTabBarIPC(tabManager) {
  // Remove existing handlers before registering new ones to prevent "duplicate handler" errors
  // This is necessary when logging out and logging back in
  const handlersToRemove = [
    'tab:create',
    'tab:switch',
    'tab:close',
    'tab:update-title',
    'tab:get-all',
    'window:minimize',
    'window:maximize',
    'window:close'
  ];
  
  handlersToRemove.forEach(handlerName => {
    try {
      ipcMain.removeHandler(handlerName);
    } catch (err) {
      // Handler might not exist, which is fine
      logger.debug(`Handler ${handlerName} not found for removal (this is OK)`);
    }
  });
  
  ipcMain.handle('tab:create', async (_event, sessionInfo, datUrl) => {
    if (!tabManager || !datWindow || datWindow.isDestroyed()) {
      return { success: false, error: 'Tab manager not initialized' };
    }
    const tabId = tabManager.createTab(sessionInfo, datUrl);
    return { success: true, tabId };
  });

  ipcMain.handle('tab:switch', async (_event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not initialized' };
    }
    tabManager.switchToTab(tabId);
    return { success: true };
  });

  ipcMain.handle('tab:close', async (_event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not initialized' };
    }
    const closed = tabManager.closeTab(tabId);
    return { success: closed };
  });

  ipcMain.handle('tab:update-title', async (_event, tabId, newTitle) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not initialized' };
    }
    tabManager.updateTabTitle(tabId, newTitle);
    return { success: true };
  });

  ipcMain.handle('tab:get-all', async () => {
    if (!tabManager) {
      return { success: false, tabs: [] };
    }
    return { success: true, tabs: tabManager.getAllTabs() };
  });
  
  // Window controls for frameless window
  ipcMain.handle('window:minimize', () => {
    if (datWindow && !datWindow.isDestroyed()) {
      datWindow.minimize();
    }
  });
  
  ipcMain.handle('window:maximize', () => {
    if (datWindow && !datWindow.isDestroyed()) {
      if (datWindow.isMaximized()) {
        datWindow.unmaximize();
      } else {
        datWindow.maximize();
      }
    }
  });
  
  ipcMain.handle('window:close', () => {
    if (datWindow && !datWindow.isDestroyed()) {
      datWindow.close();
    }
  });
}

function injectTabBarUI(webContents, tabManager) {
  const tabBarHTML = `
    <div id="dslb-tab-bar" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: #1e1e1e;
      border-bottom: 1px solid #333;
      display: flex;
      align-items: center;
      padding: 0 8px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      -webkit-app-region: drag;
    ">
      <div id="dslb-tabs-container" style="
        display: flex;
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
        height: 100%;
        -webkit-app-region: no-drag;
      "></div>
      <button id="dslb-new-tab-btn" style="
        width: 28px;
        height: 28px;
        background: transparent;
        border: none;
        color: #999;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        margin-left: 4px;
        -webkit-app-region: no-drag;
      " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#999'">+</button>
      <div id="dslb-window-controls" style="
        display: flex;
        gap: 4px;
        margin-left: 8px;
        -webkit-app-region: no-drag;
      ">
        <button id="dslb-minimize-btn" style="
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          color: #999;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#999'">−</button>
        <button id="dslb-maximize-btn" style="
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          color: #999;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#999'">□</button>
        <button id="dslb-close-btn" style="
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          color: #999;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        " onmouseover="this.style.background='rgba(255,0,0,0.2)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#999'">×</button>
      </div>
    </div>
    <div id="dslb-tab-bar-spacer" style="height: 40px;"></div>
  `;
  
  const tabBarCSS = `
    body { padding-top: 40px !important; }
    #dslb-tab-bar { 
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  
  const tabBarJS = `
    (function() {
      if (window.dslbTabBarInjected) return;
      window.dslbTabBarInjected = true;
      
      // Inject HTML
      document.body.insertAdjacentHTML('afterbegin', ${JSON.stringify(tabBarHTML)});
      
      // Inject CSS
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(tabBarCSS)};
      document.head.appendChild(style);
      
      // Tab management
      window.dslbTabManager = {
        tabs: [],
        activeTabId: null,
        
        updateTabs(tabsData) {
          this.tabs = tabsData;
          this.activeTabId = tabsData.find(t => t.active)?.id || null;
          this.renderTabs();
        },
        
        renderTabs() {
          const container = document.getElementById('dslb-tabs-container');
          if (!container) return;
          
          // Store current active tab's input value if it exists
          const activeTabInput = container.querySelector('.dslb-tab[data-tab-id="' + this.activeTabId + '"] .dslb-tab-title');
          const activeTabValue = activeTabInput ? activeTabInput.value : null;
          
          container.innerHTML = this.tabs.map(tab => {
            // Use stored value if this is the active tab and input was being edited
            const displayTitle = (tab.id === this.activeTabId && activeTabValue !== null) ? activeTabValue : tab.title;
            const escapedTitle = displayTitle.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const originalTitle = tab.title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            // Show loading indicator if tab is loading
            const loadingIndicator = tab.isLoading ? '<span style="margin-right: 6px; display: inline-block; width: 12px; height: 12px; border: 2px solid #999; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>' : '';
            const readyIndicator = (tab.isReady && !tab.isLoading) ? '<span style="margin-right: 6px; color: #4CAF50; font-size: 10px;">✓</span>' : '';
            return \`
            <div class="dslb-tab" data-tab-id="\${tab.id}" style="
              display: flex;
              align-items: center;
              min-width: 120px;
              max-width: 240px;
              height: 32px;
              padding: 0 12px;
              background: \${tab.active ? '#2d2d2d' : 'transparent'};
              border: 1px solid \${tab.active ? '#555' : 'transparent'};
              border-radius: 8px 8px 0 0;
              margin-right: 2px;
              cursor: pointer;
              color: \${tab.active ? '#fff' : '#999'};
              position: relative;
            ">
              \${loadingIndicator}\${readyIndicator}
              <input type="text" value="\${escapedTitle}" class="dslb-tab-title" readonly style="
                background: transparent;
                border: none;
                color: inherit;
                font-size: 13px;
                flex: 1;
                padding: 0;
                margin: 0;
                outline: none;
                cursor: text;
                min-width: 60px;
                pointer-events: auto;
                user-select: text;
                -webkit-user-select: text;
                width: 100%;
              " onfocus="event.stopPropagation(); this.removeAttribute('readonly'); this.select();" 
              onblur="event.stopPropagation(); this.setAttribute('readonly', 'readonly'); window.dslbTabManager.updateTitle('\${tab.id}', this.value)" 
              onkeydown="event.stopPropagation(); if(event.key==='Enter') { event.preventDefault(); this.blur(); } else if(event.key==='Escape') { this.value = '\${originalTitle}'; this.blur(); }"
              onclick="event.stopPropagation(); this.removeAttribute('readonly'); this.focus(); this.select();"
              ondblclick="event.stopPropagation(); this.removeAttribute('readonly'); this.focus(); this.select();"
              onmousedown="event.stopPropagation();">
              <button class="dslb-tab-close" style="
                width: 18px;
                height: 18px;
                background: transparent;
                border: none;
                color: #999;
                cursor: pointer;
                margin-left: 8px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                padding: 0;
                flex-shrink: 0;
              " onclick="event.stopPropagation(); window.dslbTabManager.closeTab('\${tab.id}')" 
              onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
              onmouseout="this.style.background='transparent'">×</button>
            </div>
          \`;
          }).join('');
          
          // Re-attach click handler to tab container (not input)
          container.querySelectorAll('.dslb-tab').forEach(tabEl => {
            const tabId = tabEl.dataset.tabId;
            const input = tabEl.querySelector('.dslb-tab-title');
            const closeBtn = tabEl.querySelector('.dslb-tab-close');
            
            // Only switch tab when clicking on the tab area, not input or close button
            tabEl.addEventListener('click', (e) => {
              if (e.target === input || e.target === closeBtn || input.contains(e.target) || closeBtn.contains(e.target)) {
                return; // Don't switch tab if clicking on input or close button
              }
              window.dslbTabManager.switchTab(tabId);
            });
          });
        },
        
        switchTab(tabId) {
          window.dslbSession?.switchTab?.(tabId);
        },
        
        closeTab(tabId) {
          window.dslbSession?.closeTab?.(tabId);
        },
        
        updateTitle(tabId, newTitle) {
          window.dslbSession?.updateTabTitle?.(tabId, newTitle);
        }
      };
      
      // New tab button
      const newTabBtn = document.getElementById('dslb-new-tab-btn');
      if (newTabBtn) {
        newTabBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            if (window.dslbSession && window.dslbSession.newWindow) {
              const result = await window.dslbSession.newWindow();
              console.log('New tab created:', result);
            } else {
              console.error('dslbSession.newWindow not available');
            }
  } catch (error) {
            console.error('Error creating new tab:', error);
          }
        });
      }
      
      // Window control buttons
      const minimizeBtn = document.getElementById('dslb-minimize-btn');
      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.dslbSession?.minimizeWindow?.();
        });
      }
      
      const maximizeBtn = document.getElementById('dslb-maximize-btn');
      if (maximizeBtn) {
        maximizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.dslbSession?.maximizeWindow?.();
        });
      }
      
      const closeBtn = document.getElementById('dslb-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.dslbSession?.closeWindow?.();
        });
      }
      
      // Initial render
      window.dslbTabManager.updateTabs([]);
    })();
  `;
  
  // Ensure body exists before injecting
  webContents.executeJavaScript(`
    if (!document.body) {
      document.body = document.createElement('body');
      if (document.documentElement) {
        document.documentElement.appendChild(document.body);
      }
    }
  `).catch(() => {
    // Body might not exist yet, that's okay - will retry
  });
  
  // Inject tab bar immediately
  webContents.executeJavaScript(tabBarJS).then(() => {
    logger.log('✅ Tab bar UI injected successfully');
    // Force update after injection
    setTimeout(() => {
      if (tabManager) {
        tabManager.updateTabBar();
      }
    }, 100);
  }).catch(err => {
    logger.error('❌ Failed to inject tab bar UI:', err);
    // Retry immediately and then again after a delay
    setTimeout(() => {
      // Ensure body exists
      webContents.executeJavaScript(`
        if (!document.body && document.documentElement) {
          document.body = document.createElement('body');
          document.documentElement.appendChild(document.body);
        }
      `).then(() => {
        return webContents.executeJavaScript(tabBarJS);
      }).then(() => {
        logger.log('✅ Tab bar UI injected successfully (retry)');
        if (tabManager) {
          tabManager.updateTabBar();
        }
      }).catch(retryErr => {
        logger.error('❌ Tab bar injection retry also failed:', retryErr);
        // Final retry after longer delay
        setTimeout(() => {
          webContents.executeJavaScript(tabBarJS).catch(finalErr => {
            logger.error('❌ Tab bar injection final retry failed:', finalErr);
          });
        }, 1000);
      });
    }, 200);
  });
  
  // Also try injection on dom-ready event (fires early)
  webContents.once('dom-ready', () => {
    setTimeout(() => {
      webContents.executeJavaScript(`
        if (!window.dslbTabBarInjected) {
          ${tabBarJS}
        }
      `).catch(() => {
        // Silently fail if already injected
      });
      if (tabManager) {
        tabManager.updateTabBar();
      }
    }, 50);
  });
}

function injectDATNavigationHiding(webContents) {
  // Validate webContents exists and is not destroyed
  if (!webContents || webContents.isDestroyed()) {
    return;
  }
  
  try {
    // CSS to hide the entire navigation menu bar and the prewarn dialog
    webContents.insertCSS(`
      /* Hide the entire navigation sidebar/menu bar */
      mat-sidenav.nav-left-nav,
      mat-sidenav-container .nav-left-nav {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
      }
      
      /* Adjust the main content area to take full width */
      mat-sidenav-content.nav-content {
        margin-left: 0 !important;
      }
      
      /* Hide the "logged in on another device" prewarn dialog */
      dat-prewarn-dialog-component,
      mat-dialog-container:has(dat-prewarn-dialog-component) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Hide only the overlay pane containing the prewarn dialog - NOT the entire container */
      .cdk-overlay-pane:has(dat-prewarn-dialog-component) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Hide the global wrapper containing the prewarn dialog */
      .cdk-global-overlay-wrapper:has(dat-prewarn-dialog-component) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Hide only the backdrop when prewarn dialog is shown - use child selector to not hide other overlays */
      .cdk-overlay-container:has(dat-prewarn-dialog-component) > .cdk-overlay-backdrop {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `).catch(() => {});
    
    webContents.executeJavaScript(`
      (function() {
        function hideNavigationMenuBar() {
          // Hide the entire navigation sidenav
          const navSidenav = document.querySelector('mat-sidenav.nav-left-nav');
          if (navSidenav) {
            navSidenav.style.setProperty('display', 'none', 'important');
            navSidenav.style.setProperty('visibility', 'hidden', 'important');
            navSidenav.style.setProperty('width', '0', 'important');
            navSidenav.style.setProperty('min-width', '0', 'important');
            navSidenav.style.setProperty('max-width', '0', 'important');
          }
          
          // Adjust main content to take full width
          const navContent = document.querySelector('mat-sidenav-content.nav-content');
          if (navContent) {
            navContent.style.setProperty('margin-left', '0', 'important');
          }
          
          // Also hide via the container if needed
          const navContainer = document.querySelector('mat-sidenav-container.nav-container');
          if (navContainer) {
            const sidenav = navContainer.querySelector('mat-sidenav.nav-left-nav');
            if (sidenav) {
              sidenav.style.setProperty('display', 'none', 'important');
            }
          }
        }
        
        // Run immediately
        hideNavigationMenuBar();
        
        // Run after delays to catch dynamically loaded content
        setTimeout(hideNavigationMenuBar, 500);
        setTimeout(hideNavigationMenuBar, 1000);
        setTimeout(hideNavigationMenuBar, 2000);
        setTimeout(hideNavigationMenuBar, 3000);
        
        // Watch for DOM changes and re-apply hiding
        const observer = new MutationObserver(() => {
          setTimeout(hideNavigationMenuBar, 100);
        });
        
        observer.observe(document.body, { 
          childList: true, 
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      })();
    `).catch(() => {});
  } catch (err) {
    // Silently ignore errors if webContents is destroyed during injection
    logger.log('Failed to inject navigation hiding:', err.message);
  }
}

// Manual session save removed - using standalone script instead
// ipcMain.handle('session:save-manual', async () => {

ipcMain.handle('auth:logout', async (event, data = {}) => {
  // Mark as intentional logout to prevent app.quit()
  isIntentionalLogout = true;
  
  tokens = null;
  currentUser = null;
  setupHttp(null);

  if (datWindow) {
    datWindow.close();
  }

  if (loginWindow) {
    loginWindow.show();
    loginWindow.focus();
  }

  // Show appropriate logout message based on reason
  const reason = data?.reason;
  if (reason === 'logged_out_from_another_device') {
    sendStatus('status:update', { 
      type: 'warning', 
      message: 'Signed out due to another device logged into same account. Please logout from there and login again.' 
    });
  } else {
  sendStatus('status:update', { type: 'info', message: 'Signed out.' });
  }
  
  return { success: true };
});

// Session validation handler - check if current session is still valid
ipcMain.handle('session:validate', async () => {
  try {
    if (!tokens || !tokens.accessToken) {
      logger.log('🔒 Session validation: No active session');
      return { valid: false, reason: 'No active session' };
    }

    // Call backend to validate session
    const response = await http.get('/auth/session-status');
    
    if (response.data && response.data.valid) {
      // Only log in debug mode to reduce log verbosity
      logger.debug('✅ Session validation: Session is valid');
      return { valid: true };
    } else {
      // Session expired on backend but might be recoverable
      logger.log('⚠️ Session validation: Session expired on backend');
      return { valid: false, reason: 'Session expired' };
    }
  } catch (error) {
    // Check if error is due to session invalidation
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || '';
    
    if (message.includes('Session invalidated') || message.includes('another device')) {
      // User was logged in from another device - this is a real invalidation
      logger.log('🔒 Session validation: Logged out from another device');
      return { 
        valid: false, 
        reason: 'logged_out_from_another_device',
        message: 'You have been logged out because you logged in from another device.'
      };
    } else if (status === 401) {
      // Token expired - try to refresh it first
      logger.warn('⚠️ Session validation: Token expired (401) - attempting refresh...');
      
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        // Token refreshed successfully - retry validation
        try {
          const retryResponse = await http.get('/auth/session-status');
          if (retryResponse.data && retryResponse.data.valid) {
            logger.log('✅ Session validation: Valid after token refresh');
            return { valid: true };
          }
        } catch (retryError) {
          logger.error('❌ Session validation failed after refresh:', retryError.response?.data?.message || retryError.message);
        }
      }
      
      // If refresh failed or retry failed, return as invalid
      // Renderer will track consecutive failures and logout after 3 failures (30 seconds)
      logger.warn('⚠️ Session validation: Token expired and refresh failed - marking as invalid');
      return { valid: false, reason: 'token_expired' };
    } else {
      // Network or other error - don't force logout, might be temporary
      logger.warn('⚠️ Session validation failed (network error):', error.message);
      return { valid: true }; // Assume valid to avoid false positives
    }
  }
});







