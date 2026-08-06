/**
 * Geo Utilities for GPS coordinates conversion and reverse geocoding
 */

// Convert DMS (Degrees, Minutes, Seconds) array or raw numbers to decimal degrees
export function dmsToDecimal(degrees, minutes, seconds, direction) {
  let dd = Number(degrees) + Number(minutes) / 60 + Number(seconds) / 3600;
  if (direction === 'S' || direction === 'W') {
    dd = dd * -1;
  }
  return Number(dd.toFixed(6));
}

// Formats decimal latitude/longitude into human-readable strings
export function formatCoordinates(lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

  const latRef = lat >= 0 ? 'N' : 'S';
  const lngRef = lng >= 0 ? 'E' : 'W';

  const absLat = Math.abs(lat);
  const absLng = Math.abs(lng);

  const latDeg = Math.floor(absLat);
  const latMin = Math.floor((absLat - latDeg) * 60);
  const latSec = (((absLat - latDeg) * 60 - latMin) * 60).toFixed(2);

  const lngDeg = Math.floor(absLng);
  const lngMin = Math.floor((absLng - lngDeg) * 60);
  const lngSec = (((absLng - lngDeg) * 60 - lngMin) * 60).toFixed(2);

  return {
    lat,
    lng,
    dmsLat: `${latDeg}° ${latMin}' ${latSec}" ${latRef}`,
    dmsLng: `${lngDeg}° ${lngMin}' ${lngSec}" ${lngRef}`,
    formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  };
}

// Reverse geocode via OpenStreetMap Nominatim API
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MetaCheckCleanerWin11/1.0'
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    return {
      displayName: data.display_name,
      address: data.address || {}
    };
  } catch (error) {
    console.warn('Reverse geocoding error:', error);
    return null;
  }
}
