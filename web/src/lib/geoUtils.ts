// ==============================================================================
// HAVERSINE DISTANCE & GEOLOCATION UTILITIES
// Designed & Managed by Vedotrix Technologies
// ==============================================================================

/**
 * Calculates distance in meters between two latitude/longitude points using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Rounded to 2 decimal places
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Formats distance nicely (meters or kilometers)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} meters`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Checks whether user coordinates are within an office geofence radius
 */
export function isWithinOfficeRadius(
  userLat: number,
  userLon: number,
  officeLat: number,
  officeLon: number,
  radiusMeters: number
): { isInside: boolean; distanceMeters: number } {
  const distance = calculateHaversineDistance(userLat, userLon, officeLat, officeLon);
  return {
    isInside: distance <= radiusMeters,
    distanceMeters: distance
  };
}
