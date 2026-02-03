/**
 * Device Fingerprinting Utility
 * 
 * Extracts device information from User-Agent strings and client metadata
 */

export interface DeviceInfo {
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  device?: string;
  deviceType?: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';
  platform?: string;
  fullInfo?: string;
}

/**
 * Parse User-Agent string to extract device information
 * 
 * @param userAgent - The User-Agent string from HTTP request
 * @returns Parsed device information
 */
export function parseDeviceInfo(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return {
      deviceType: 'Unknown',
      fullInfo: 'Unknown Device',
    };
  }

  const info: DeviceInfo = {
    fullInfo: userAgent,
  };

  // Detect OS
  if (userAgent.includes('Windows NT 10.0')) {
    info.os = 'Windows';
    info.osVersion = '10/11';
  } else if (userAgent.includes('Windows NT 6.3')) {
    info.os = 'Windows';
    info.osVersion = '8.1';
  } else if (userAgent.includes('Windows NT 6.2')) {
    info.os = 'Windows';
    info.osVersion = '8';
  } else if (userAgent.includes('Windows NT 6.1')) {
    info.os = 'Windows';
    info.osVersion = '7';
  } else if (userAgent.includes('Mac OS X')) {
    info.os = 'macOS';
    const match = userAgent.match(/Mac OS X (\d+[._]\d+[._]\d+)/);
    if (match && match[1]) {
      info.osVersion = match[1].replace(/_/g, '.');
    }
  } else if (userAgent.includes('Linux')) {
    info.os = 'Linux';
  } else if (userAgent.includes('Android')) {
    info.os = 'Android';
    const match = userAgent.match(/Android (\d+\.\d+)/);
    if (match) {
      info.osVersion = match[1];
    }
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    info.os = 'iOS';
    const match = userAgent.match(/OS (\d+_\d+)/);
    if (match && match[1]) {
      info.osVersion = match[1].replace(/_/g, '.');
    }
  }

  // Detect Browser
  if (userAgent.includes('Edg/')) {
    info.browser = 'Edge';
    const match = userAgent.match(/Edg\/(\d+\.\d+)/);
    if (match) {
      info.browserVersion = match[1];
    }
  } else if (userAgent.includes('Chrome/') && !userAgent.includes('Chromium')) {
    info.browser = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
    if (match) {
      info.browserVersion = match[1];
    }
  } else if (userAgent.includes('Firefox/')) {
    info.browser = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    if (match) {
      info.browserVersion = match[1];
    }
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    info.browser = 'Safari';
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    if (match) {
      info.browserVersion = match[1];
    }
  } else if (userAgent.includes('Electron')) {
    info.browser = 'Electron';
    const match = userAgent.match(/Electron\/(\d+\.\d+)/);
    if (match) {
      info.browserVersion = match[1];
    }
  }

  // Detect Device Type
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    info.deviceType = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    info.deviceType = 'Tablet';
  } else {
    info.deviceType = 'Desktop';
  }

  // Detect specific device
  if (userAgent.includes('iPhone')) {
    info.device = 'iPhone';
  } else if (userAgent.includes('iPad')) {
    info.device = 'iPad';
  } else if (userAgent.includes('Macintosh')) {
    info.device = 'Mac';
  } else if (userAgent.includes('Windows')) {
    info.device = 'Windows PC';
  } else if (userAgent.includes('Linux')) {
    info.device = 'Linux PC';
  }

  // Detect platform
  if (userAgent.includes('Win64') || userAgent.includes('WOW64')) {
    info.platform = 'Windows 64-bit';
  } else if (userAgent.includes('Win32')) {
    info.platform = 'Windows 32-bit';
  } else if (userAgent.includes('x86_64') || userAgent.includes('x64')) {
    info.platform = '64-bit';
  } else if (userAgent.includes('ARM')) {
    info.platform = 'ARM';
  }

  return info;
}

/**
 * Create a readable device fingerprint string
 * Example: "Windows 10 - Chrome 131 - Desktop"
 * 
 * @param deviceInfo - Parsed device information
 * @returns Human-readable device fingerprint
 */
export function getDeviceFingerprint(deviceInfo: DeviceInfo): string {
  const parts: string[] = [];

  if (deviceInfo.os) {
    parts.push(deviceInfo.osVersion ? `${deviceInfo.os} ${deviceInfo.osVersion}` : deviceInfo.os);
  }

  if (deviceInfo.browser) {
    parts.push(
      deviceInfo.browserVersion 
        ? `${deviceInfo.browser} ${deviceInfo.browserVersion}` 
        : deviceInfo.browser
    );
  }

  if (deviceInfo.deviceType) {
    parts.push(deviceInfo.deviceType);
  }

  return parts.length > 0 ? parts.join(' - ') : 'Unknown Device';
}

/**
 * Compare two device fingerprints to check if they're the same device
 * 
 * @param device1 - First device info
 * @param device2 - Second device info
 * @returns True if devices match, false otherwise
 */
export function areSameDevice(device1: DeviceInfo, device2: DeviceInfo): boolean {
  // Compare OS
  if (device1.os && device2.os && device1.os !== device2.os) {
    return false;
  }

  // Compare browser
  if (device1.browser && device2.browser && device1.browser !== device2.browser) {
    return false;
  }

  // Compare device type
  if (device1.deviceType && device2.deviceType && device1.deviceType !== device2.deviceType) {
    return false;
  }

  // If all match (or are undefined), consider them the same
  return true;
}

/**
 * Create device info from client metadata
 * This is used when device info is sent from the Electron client
 * 
 * @param metadata - Client metadata object
 * @returns DeviceInfo object
 */
export function createDeviceInfoFromMetadata(metadata: {
  os?: string;
  platform?: string;
  hostname?: string;
  macAddress?: string;
  userAgent?: string;
}): string {
  const parts: string[] = [];

  if (metadata.os) {
    parts.push(metadata.os);
  }

  if (metadata.platform) {
    parts.push(metadata.platform);
  }

  if (metadata.hostname) {
    parts.push(`[${metadata.hostname}]`);
  }

  if (metadata.macAddress) {
    parts.push(`MAC: ${metadata.macAddress.substring(0, 8)}...`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Unknown Device';
}

