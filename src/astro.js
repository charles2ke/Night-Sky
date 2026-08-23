// Astronomical calculations for the night sky reconstruction.
// Algorithms follow the low-precision methods described in
// Jean Meeus, "Astronomical Algorithms" (2nd ed.).

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

const norm360 = (x) => ((x % 360) + 360) % 360;

/** Julian Day for a JavaScript Date interpreted as UTC. */
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Julian centuries since J2000.0. */
export function centuries(jd) {
  return (jd - 2451545) / 36525;
}

/** Greenwich mean sidereal time in degrees. */
export function gmst(jd) {
  const t = centuries(jd);
  return norm360(
    280.46061837 +
      360.98564736629 * (jd - 2451545) +
      0.000387933 * t * t -
      (t * t * t) / 38710000
  );
}

/** Local mean sidereal time in degrees for a longitude (east positive). */
export function lmst(jd, longitude) {
  return norm360(gmst(jd) + longitude);
}

/**
 * Precess J2000 equatorial coordinates (degrees) to the equinox of date,
 * using the IAU 1976 precession angles.
 */
export function precessFromJ2000(ra, dec, jd) {
  const t = centuries(jd);
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) / 3600;

  const raR = ra * DEG;
  const decR = dec * DEG;
  const A = Math.cos(decR) * Math.sin(raR + zeta * DEG);
  const B =
    Math.cos(theta * DEG) * Math.cos(decR) * Math.cos(raR + zeta * DEG) -
    Math.sin(theta * DEG) * Math.sin(decR);
  const C =
    Math.sin(theta * DEG) * Math.cos(decR) * Math.cos(raR + zeta * DEG) +
    Math.cos(theta * DEG) * Math.sin(decR);

  return {
    ra: norm360(Math.atan2(A, B) * RAD + z),
    dec: Math.asin(Math.max(-1, Math.min(1, C))) * RAD,
  };
}

/** Convert equatorial coordinates (degrees) to horizontal altitude/azimuth. */
export function equatorialToHorizontal(ra, dec, siderealTime, latitude) {
  const h = (siderealTime - ra) * DEG;
  const decR = dec * DEG;
  const latR = latitude * DEG;
  const sinAlt =
    Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(h);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(
    Math.sin(h),
    Math.cos(h) * Math.sin(latR) - Math.tan(decR) * Math.cos(latR)
  );
  return { alt: alt * RAD, az: norm360(az * RAD + 180) };
}

/** Mean obliquity of the ecliptic in degrees. */
export function obliquity(jd) {
  const t = centuries(jd);
  return 23.4392911 - 0.0130042 * t - 1.64e-7 * t * t + 5.04e-7 * t * t * t;
}

/** Convert ecliptic longitude/latitude (degrees) to equatorial coordinates. */
export function eclipticToEquatorial(lon, lat, jd) {
  const eps = obliquity(jd) * DEG;
  const l = lon * DEG;
  const b = lat * DEG;
  const ra = Math.atan2(
    Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps),
    Math.cos(l)
  );
  const dec = Math.asin(
    Math.max(
      -1,
      Math.min(1, Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l))
    )
  );
  return { ra: norm360(ra * RAD), dec: dec * RAD };
}

/** Geometric position of the Sun (equatorial, equinox of date). */
export function sunPosition(jd) {
  const t = centuries(jd);
  const L0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const M = norm360(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const mR = M * DEG;
  const C =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mR) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mR) +
    0.000289 * Math.sin(3 * mR);
  const trueLon = L0 + C;
  const e = 0.016708634 - 0.000042037 * t;
  const v = mR + C * DEG;
  const distance = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(v));
  const eq = eclipticToEquatorial(trueLon, 0, jd);
  return { ...eq, lon: norm360(trueLon), lat: 0, distance, name: 'Sun' };
}

/**
 * Position of the Moon (equatorial, equinox of date) using the main periodic
 * terms of the ELP-2000/82 truncation given by Meeus, chapter 47.
 */
export function moonPosition(jd) {
  const t = centuries(jd);
  const Lp = norm360(218.3164477 + 481267.88123421 * t - 0.0015786 * t * t);
  const D = norm360(297.8501921 + 445267.1114034 * t - 0.0018819 * t * t) * DEG;
  const M = norm360(357.5291092 + 35999.0502909 * t - 0.0001536 * t * t) * DEG;
  const Mp = norm360(134.9633964 + 477198.8675055 * t + 0.0087414 * t * t) * DEG;
  const F = norm360(93.272095 + 483202.0175233 * t - 0.0036539 * t * t) * DEG;

  const lon =
    Lp +
    (6.288774 * Math.sin(Mp) +
      1.274027 * Math.sin(2 * D - Mp) +
      0.658314 * Math.sin(2 * D) +
      0.213618 * Math.sin(2 * Mp) -
      0.185116 * Math.sin(M) -
      0.114332 * Math.sin(2 * F) +
      0.058793 * Math.sin(2 * D - 2 * Mp) +
      0.057066 * Math.sin(2 * D - M - Mp) +
      0.053322 * Math.sin(2 * D + Mp) +
      0.045758 * Math.sin(2 * D - M) -
      0.040923 * Math.sin(M - Mp) -
      0.03472 * Math.sin(D) -
      0.030383 * Math.sin(M + Mp) +
      0.015327 * Math.sin(2 * D - 2 * F) -
      0.012528 * Math.sin(Mp + 2 * F) +
      0.01098 * Math.sin(Mp - 2 * F));

  const lat =
    5.128122 * Math.sin(F) +
    0.280602 * Math.sin(Mp + F) +
    0.277693 * Math.sin(Mp - F) +
    0.173237 * Math.sin(2 * D - F) +
    0.055413 * Math.sin(2 * D - Mp + F) +
    0.046271 * Math.sin(2 * D - Mp - F) +
    0.032573 * Math.sin(2 * D + F) +
    0.017198 * Math.sin(2 * Mp + F) +
    0.009266 * Math.sin(2 * D + Mp - F);

  const distanceKm =
    385000.56 -
    20905.355 * Math.cos(Mp) -
    3699.111 * Math.cos(2 * D - Mp) -
    2955.968 * Math.cos(2 * D) -
    569.925 * Math.cos(2 * Mp);

  const eq = eclipticToEquatorial(norm360(lon), lat, jd);
  return { ...eq, lon: norm360(lon), lat, distanceKm };
}

/**
 * Illuminated fraction and phase of the Moon. `brightLimbAngle` is the
 * position angle of the bright limb, used when rendering the terminator.
 */
export function moonPhase(jd) {
  const moon = moonPosition(jd);
  const sun = sunPosition(jd);
  const cosElong =
    Math.sin(sun.dec * DEG) * Math.sin(moon.dec * DEG) +
    Math.cos(sun.dec * DEG) * Math.cos(moon.dec * DEG) * Math.cos((sun.ra - moon.ra) * DEG);
  const elongation = Math.acos(Math.max(-1, Math.min(1, cosElong)));
  const sunDistKm = sun.distance * 149597870.7;
  const phaseAngle = Math.atan2(
    sunDistKm * Math.sin(elongation),
    moon.distanceKm - sunDistKm * Math.cos(elongation)
  );
  const illumination = (1 + Math.cos(phaseAngle)) / 2;

  // The signed difference in ecliptic longitude tells us waxing vs waning.
  const diff = norm360(moon.lon - sun.lon);

  const brightLimbAngle = Math.atan2(
    Math.cos(sun.dec * DEG) * Math.sin((sun.ra - moon.ra) * DEG),
    Math.sin(sun.dec * DEG) * Math.cos(moon.dec * DEG) -
      Math.cos(sun.dec * DEG) * Math.sin(moon.dec * DEG) * Math.cos((sun.ra - moon.ra) * DEG)
  );

  return {
    ...moon,
    illumination,
    waxing: diff < 180,
    age: (diff / 360) * 29.530588853,
    brightLimbAngle: brightLimbAngle * RAD,
    phaseName: phaseName(diff, illumination),
  };
}

function phaseName(diff, illumination) {
  if (illumination < 0.02) return 'New Moon';
  if (illumination > 0.98) return 'Full Moon';
  if (Math.abs(diff - 90) < 5) return 'First Quarter';
  if (Math.abs(diff - 270) < 5) return 'Last Quarter';
  if (diff < 90) return 'Waxing Crescent';
  if (diff < 180) return 'Waxing Gibbous';
  if (diff < 270) return 'Waning Gibbous';
  return 'Waning Crescent';
}

// Heliocentric orbital elements (J2000) and their centennial rates, from the
// JPL "approximate positions of the major planets" tables.
const PLANETS = [
  { name: 'Mercury', mag: -0.4, color: '#d9cfc0',
    a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], i: [7.00497902, -0.00594749],
    L: [252.2503235, 149472.67411175], w: [77.45779628, 0.16047689], o: [48.33076593, -0.12534081] },
  { name: 'Venus', mag: -4.2, color: '#fdf3d8',
    a: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], i: [3.39467605, -0.0007889],
    L: [181.9790995, 58517.81538729], w: [131.60246718, 0.00268329], o: [76.67984255, -0.27769418] },
  { name: 'Mars', mag: -1.0, color: '#e08a5a',
    a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], i: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], o: [49.55953891, -0.29257343] },
  { name: 'Jupiter', mag: -2.5, color: '#f0e0c0',
    a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], i: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775], w: [14.72847983, 0.21252668], o: [100.47390909, 0.20469106] },
  { name: 'Saturn', mag: 0.5, color: '#efe3b8',
    a: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], i: [2.48599187, 0.00193609],
    L: [49.95424423, 1222.49362201], w: [92.59887831, -0.41897216], o: [113.66242448, -0.28867794] },
  { name: 'Earth', mag: 0, color: '#ffffff',
    a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], i: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], o: [0, 0] },
];

function heliocentric(p, t) {
  const a = p.a[0] + p.a[1] * t;
  const e = p.e[0] + p.e[1] * t;
  const i = (p.i[0] + p.i[1] * t) * DEG;
  const L = p.L[0] + p.L[1] * t;
  const w = p.w[0] + p.w[1] * t;
  const o = (p.o[0] + p.o[1] * t) * DEG;

  const M = norm360(L - w) * DEG;
  let E = M;
  for (let k = 0; k < 12; k++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const argPeri = (w - (p.o[0] + p.o[1] * t)) * DEG;
  const xh =
    xv * (Math.cos(o) * Math.cos(argPeri) - Math.sin(o) * Math.sin(argPeri) * Math.cos(i)) -
    yv * (Math.cos(o) * Math.sin(argPeri) + Math.sin(o) * Math.cos(argPeri) * Math.cos(i));
  const yh =
    xv * (Math.sin(o) * Math.cos(argPeri) + Math.cos(o) * Math.sin(argPeri) * Math.cos(i)) +
    yv * (Math.cos(o) * Math.cos(argPeri) * Math.cos(i) - Math.sin(o) * Math.sin(argPeri));
  const zh = xv * Math.sin(argPeri) * Math.sin(i) + yv * Math.cos(argPeri) * Math.sin(i);
  return { x: xh, y: yh, z: zh };
}

/** Geocentric equatorial positions of the naked-eye planets. */
export function planetPositions(jd) {
  const t = centuries(jd);
  const earth = heliocentric(PLANETS[PLANETS.length - 1], t);
  const out = [];
  for (const p of PLANETS) {
    if (p.name === 'Earth') continue;
    const h = heliocentric(p, t);
    const x = h.x - earth.x;
    const y = h.y - earth.y;
    const z = h.z - earth.z;
    const lon = norm360(Math.atan2(y, x) * RAD);
    const lat = Math.atan2(z, Math.hypot(x, y)) * RAD;
    const eq = eclipticToEquatorial(lon, lat, jd);
    out.push({ name: p.name, color: p.color, mag: p.mag, ...eq });
  }
  return out;
}

/** Convert galactic coordinates to J2000 equatorial coordinates. */
export function galacticToEquatorial(l, b) {
  const lR = l * DEG;
  const bR = b * DEG;
  const raNGP = 192.85948 * DEG;
  const decNGP = 27.12825 * DEG;
  const lNCP = 122.93192 * DEG;
  const dec = Math.asin(
    Math.max(
      -1,
      Math.min(1, Math.sin(decNGP) * Math.sin(bR) + Math.cos(decNGP) * Math.cos(bR) * Math.cos(lNCP - lR))
    )
  );
  const ra =
    raNGP +
    Math.atan2(
      Math.cos(bR) * Math.sin(lNCP - lR),
      Math.cos(decNGP) * Math.sin(bR) - Math.sin(decNGP) * Math.cos(bR) * Math.cos(lNCP - lR)
    );
  return { ra: norm360(ra * RAD), dec: dec * RAD };
}

/** Approximate a B-V colour index as an RGB colour string. */
export function bvToColor(bv) {
  const t = Math.max(-0.4, Math.min(2, Number(bv) || 0));
  let r;
  let g;
  let b;
  if (t < 0) {
    r = 0.61 + 0.11 * t + 0.1 * t * t;
    g = 0.7 + 0.07 * t + 0.1 * t * t;
    b = 1;
  } else if (t < 0.4) {
    r = 0.83 + 0.17 * t;
    g = 0.87 + 0.11 * t;
    b = 1;
  } else if (t < 1.6) {
    r = 1;
    g = 0.98 - 0.16 * (t - 0.4);
    b = 1 - 0.4 * (t - 0.4);
  } else {
    r = 1;
    g = 0.79 - 0.1 * (t - 1.6);
    b = 0.52 - 0.2 * (t - 1.6);
  }
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/**
 * Convert a local wall-clock date/time at a place to a UTC Date.
 * Uses the IANA time zone when available, otherwise the longitude offset.
 */
export function localToUtc(dateStr, timeStr, timeZone, longitude) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (timeStr || '00:00').split(':').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // Date.UTC maps years 0-99 into the 20th century; undo that for old dates.
  const naiveDate = new Date(naive);
  if (y >= 0 && y < 100) naiveDate.setUTCFullYear(y);
  const offsetMinutes = timeZoneOffsetMinutes(naiveDate, timeZone, longitude);
  return { date: new Date(naiveDate.getTime() - offsetMinutes * 60000), offsetMinutes };
}

/** Offset of a time zone from UTC, in minutes, at a given instant. */
export function timeZoneOffsetMinutes(date, timeZone, longitude) {
  if (timeZone) {
    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        era: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const parts = {};
      for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
      const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
      const asUTC = new Date(0);
      asUTC.setUTCFullYear(year, Number(parts.month) - 1, Number(parts.day));
      asUTC.setUTCHours(Number(parts.hour) % 24, Number(parts.minute), Number(parts.second), 0);
      return Math.round((asUTC.getTime() - date.getTime()) / 60000);
    } catch {
      /* fall through to the longitude estimate */
    }
  }
  return Math.round((longitude || 0) / 15) * 60;
}

/** Format an offset in minutes as e.g. "UTC+05:30". */
export function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

/** Format decimal degrees as e.g. "28.4595° N". */
export function formatCoord(value, positive, negative) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}
