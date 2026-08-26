// Resolving a place name to coordinates and a time zone.
// Uses the Open-Meteo geocoding API when the network is available and falls
// back to a small built-in gazetteer plus direct "lat, lon" input.

const FALLBACK_PLACES = [
  { name: 'Gurugram', country: 'India', admin1: 'Haryana', latitude: 28.4595, longitude: 77.0266, timezone: 'Asia/Kolkata', population: 876824 },
  { name: 'Delhi', country: 'India', admin1: 'Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', population: 16787941 },
  { name: 'Al Ain', country: 'United Arab Emirates', admin1: 'Abu Dhabi', latitude: 24.1917, longitude: 55.7605, timezone: 'Asia/Dubai', population: 766936 },
  { name: 'Dubai', country: 'United Arab Emirates', admin1: 'Dubai', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai', population: 3331420 },
  { name: 'London', country: 'United Kingdom', admin1: 'England', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London', population: 8961989 },
  { name: 'New York', country: 'United States', admin1: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', population: 8175133 },
  { name: 'San Francisco', country: 'United States', admin1: 'California', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles', population: 864816 },
  { name: 'Reykjavik', country: 'Iceland', admin1: 'Capital Region', latitude: 64.1466, longitude: -21.9426, timezone: 'Atlantic/Reykjavik', population: 135688 },
  { name: 'Cape Town', country: 'South Africa', admin1: 'Western Cape', latitude: -33.9249, longitude: 18.4241, timezone: 'Africa/Johannesburg', population: 3433441 },
  { name: 'Sydney', country: 'Australia', admin1: 'New South Wales', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', population: 4840600 },
  { name: 'Tokyo', country: 'Japan', admin1: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', population: 13515271 },
  { name: 'Santiago', country: 'Chile', admin1: 'Santiago Metropolitan', latitude: -33.4489, longitude: -70.6693, timezone: 'America/Santiago', population: 4837295 },
  { name: 'Nairobi', country: 'Kenya', admin1: 'Nairobi', latitude: -1.2864, longitude: 36.8172, timezone: 'Africa/Nairobi', population: 4397073 },
  { name: 'Reyðarfjörður', country: 'Iceland', admin1: 'Eastern Region', latitude: 65.0333, longitude: -14.2167, timezone: 'Atlantic/Reykjavik', population: 1300 },
  { name: 'Atacama Desert', country: 'Chile', admin1: 'Antofagasta', latitude: -24.5, longitude: -69.25, timezone: 'America/Santiago', population: 500 },
];

const COORDINATE_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*[,;/ ]\s*(-?\d+(?:\.\d+)?)\s*$/;
const MAX_QUERY_LENGTH = 120;

/**
 * Check that a place query could plausibly be resolved, and throw a helpful
 * error when it cannot. Returns the trimmed query.
 */
export function validatePlaceQuery(query) {
  const text = typeof query === 'string' ? query.trim() : '';
  if (!text) {
    throw new Error('Please enter a place, for example "Gurugram, India" or "28.4595, 77.0266".');
  }
  if (text.length > MAX_QUERY_LENGTH) {
    throw new Error(`Please enter a shorter place name (up to ${MAX_QUERY_LENGTH} characters).`);
  }
  const numbers = COORDINATE_PATTERN.exec(text);
  if (numbers) {
    const latitude = Number(numbers[1]);
    const longitude = Number(numbers[2]);
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error(
        'Coordinates are out of range: latitude must be between -90 and 90, longitude between -180 and 180.'
      );
    }
    return text;
  }
  if (!/\p{Letter}/u.test(text)) {
    throw new Error('Please enter a place name, or coordinates as "latitude, longitude".');
  }
  return text;
}

/** Parse a raw "lat, lon" string, or return null when it is not coordinates. */
export function parseCoordinates(query) {
  const m = COORDINATE_PATTERN.exec(query);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitude,
    longitude,
    timezone: null,
    population: 0,
    source: 'coordinates',
  };
}

function label(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(', ');
}

function searchFallback(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const match =
    FALLBACK_PLACES.find((p) => p.name.toLowerCase() === q) ||
    FALLBACK_PLACES.find((p) => label(p).toLowerCase().includes(q)) ||
    FALLBACK_PLACES.find((p) => p.name.toLowerCase().startsWith(q));
  if (!match) return null;
  return { ...match, label: label(match), source: 'builtin' };
}

/**
 * Resolve a place. Coordinates are used directly, otherwise the geocoding
 * service is queried, with the built-in gazetteer as a fallback.
 */
export async function resolvePlace(query, { fetchImpl = globalThis.fetch } = {}) {
  const text = validatePlaceQuery(query);
  const coords = parseCoordinates(text);
  if (coords) return { ...coords, label: coords.name };

  if (fetchImpl) {
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', text);
      url.searchParams.set('count', '1');
      url.searchParams.set('language', 'en');
      url.searchParams.set('format', 'json');
      const response = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const data = await response.json();
        const hit = data && data.results && data.results[0];
        if (hit) {
          return {
            name: hit.name,
            admin1: hit.admin1,
            country: hit.country,
            label: label(hit),
            latitude: hit.latitude,
            longitude: hit.longitude,
            timezone: hit.timezone,
            population: hit.population || 0,
            source: 'open-meteo',
          };
        }
      }
    } catch {
      /* offline or blocked: fall back to the built-in list */
    }
  }

  const fallback = searchFallback(text);
  if (fallback) return fallback;
  throw new Error(`Could not find "${text}". Try another place, or enter "latitude, longitude".`);
}

export { FALLBACK_PLACES };
