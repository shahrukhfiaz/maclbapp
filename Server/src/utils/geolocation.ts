/**
 * Geolocation Utility
 * 
 * Retrieves geographical location information from IP addresses
 * using the ip-api.com free API (no API key required)
 */

import axios from 'axios';
import { logger } from '../config/logger';

export interface LocationData {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  location?: string; // Formatted string: "City, Country"
}

/**
 * Get location data from IP address using ip-api.com
 * Free tier: 45 requests per minute
 * 
 * @param ipAddress - The IP address to lookup
 * @returns Location data or null if lookup fails
 */
export async function getLocationFromIP(ipAddress: string | undefined): Promise<LocationData | null> {
  // Handle localhost and private IPs
  if (!ipAddress || 
      ipAddress === '::1' || 
      ipAddress === '127.0.0.1' || 
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('172.')) {
    return {
      city: 'Local',
      country: 'Local Network',
      location: 'Local Network',
    };
  }

  try {
    // ip-api.com free API
    const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
      params: {
        fields: 'status,message,country,city,lat,lon,regionName'
      },
      timeout: 5000
    });

    if (response.data.status === 'success') {
      const data = response.data;
      return {
        city: data.city || undefined,
        region: data.regionName || undefined,
        country: data.country || undefined,
        latitude: data.lat || undefined,
        longitude: data.lon || undefined,
        location: `${data.city || 'Unknown'}, ${data.country || 'Unknown'}`,
      };
    } else {
      logger.warn(`Geolocation lookup failed for ${ipAddress}: ${response.data.message}`);
      return null;
    }
  } catch (error: any) {
    logger.error(`Error getting location for IP ${ipAddress}:`, error.message);
    return null;
  }
}

/**
 * Calculate distance between two geographic coordinates (Haversine formula)
 * Used to detect suspicious location changes
 * 
 * @param lat1 - Latitude of first location
 * @param lon1 - Longitude of first location
 * @param lat2 - Latitude of second location
 * @param lon2 - Longitude of second location
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a location change is suspicious based on distance and time
 * Example: 1000+ km in less than 1 hour is likely impossible
 * 
 * @param prevLat - Previous latitude
 * @param prevLon - Previous longitude
 * @param newLat - New latitude
 * @param newLon - New longitude
 * @param timeDiffMinutes - Time difference in minutes
 * @returns True if suspicious, false otherwise
 */
export function isSuspiciousLocationChange(
  prevLat: number,
  prevLon: number,
  newLat: number,
  newLon: number,
  timeDiffMinutes: number
): boolean {
  const distance = calculateDistance(prevLat, prevLon, newLat, newLon);
  
  // If distance > 500 km and time < 60 minutes, it's suspicious
  // (human can't travel that fast without flying)
  if (distance > 500 && timeDiffMinutes < 60) {
    return true;
  }
  
  // If distance > 2000 km and time < 180 minutes (3 hours), it's suspicious
  if (distance > 2000 && timeDiffMinutes < 180) {
    return true;
  }
  
  return false;
}

