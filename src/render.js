// Canvas renderer producing a wide panoramic reconstruction of the night sky,
// following the visual style described in
// .github/skills/historical-night-sky-generator/SKILL.md
import {
  DEG,
  RAD,
  bvToColor,
  equatorialToHorizontal,
  formatCoord,
  galacticToEquatorial,
  julianDay,
  lmst,
  moonPhase,
  planetPositions,
  precessFromJ2000,
} from './astro.js';

const HORIZONTAL_FOV = 140; // degrees across the panorama
const HORIZON_FRACTION = 0.86; // horizon sits in the lowest ~14%
const MOON_EXAGGERATION = 3; // apparent size multiplier so the phase is visible

export const DIRECTIONS = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

const COMPASS_POINTS = [
  [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
  [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
];

const angleDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/**
 * Compute everything that is visible in the panorama for the given moment.
 * Returned coordinates are in the horizontal (alt/az) frame.
 */
export function computeSky({ date, latitude, longitude, stars, constellations }) {
  const jd = julianDay(date);
  const st = lmst(jd, longitude);
  const toHorizontal = (ra, dec) => {
    const p = precessFromJ2000(ra, dec, jd);
    return equatorialToHorizontal(p.ra, p.dec, st, latitude);
  };

  const visibleStars = [];
  for (const s of stars) {
    const [ra, dec, mag, bv, name] = s;
    const h = toHorizontal(ra, dec);
    if (h.alt < -2) continue;
    visibleStars.push({ ...h, mag, bv, name });
  }

  const lines = [];
  for (const c of constellations) {
    for (const line of c.lines) {
      lines.push(line.map(([ra, dec]) => toHorizontal(ra, dec)));
    }
  }

  const moon = moonPhase(jd);
  const moonHorizontal = equatorialToHorizontal(moon.ra, moon.dec, st, latitude);

  const planets = planetPositions(jd).map((p) => ({
    ...p,
    ...equatorialToHorizontal(p.ra, p.dec, st, latitude),
  }));

  const milkyWay = [];
  for (let l = 0; l < 360; l += 2) {
    for (let b = -18; b <= 18; b += 2) {
      const eq = galacticToEquatorial(l, b);
      const h = toHorizontal(eq.ra, eq.dec);
      if (h.alt < -5) continue;
      // The band is brightest towards the galactic centre and near b = 0.
      const centreBoost = 1 - Math.min(1, Math.abs(angleDiff(l, 0)) / 110) * 0.75;
      const density = Math.exp(-(b * b) / 90) * centreBoost;
      milkyWay.push({ ...h, density });
    }
  }

  return { jd, siderealTime: st, stars: visibleStars, constellationLines: lines, moon: { ...moon, ...moonHorizontal }, planets, milkyWay };
}

function createProjection(width, height, viewAzimuth) {
  const scale = width / HORIZONTAL_FOV; // pixels per degree
  const horizonY = height * HORIZON_FRACTION;
  return {
    scale,
    horizonY,
    project(alt, az) {
      const dx = angleDiff(az, viewAzimuth);
      return { x: width / 2 + dx * scale, y: horizonY - alt * scale, dx };
    },
  };
}

/**
 * Draw the night sky panorama onto a canvas.
 * `sky` comes from computeSky(); `info` supplies the overlay text.
 */
export function renderSky(canvas, sky, options) {
  const {
    viewDirection = 'S',
    lightPollution = 0.35,
    showConstellations = true,
    showLabels = true,
    place = '',
    dateLabel = '',
    timeLabel = '',
    coordsLabel = '',
    terrainSeed = 1,
  } = options;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const viewAzimuth = DIRECTIONS[viewDirection] ?? 180;
  const proj = createProjection(width, height, viewAzimuth);

  drawSkyGradient(ctx, width, height, proj.horizonY, lightPollution);
  drawMilkyWay(ctx, proj, sky.milkyWay, lightPollution);
  if (showConstellations) drawConstellations(ctx, proj, sky.constellationLines, width);
  drawStars(ctx, proj, sky.stars, height, lightPollution, showLabels);
  drawPlanets(ctx, proj, sky.planets, height, showLabels);
  drawMoon(ctx, proj, sky.moon, proj.scale);
  drawHorizon(ctx, width, height, proj.horizonY, lightPollution, terrainSeed);
  drawOverlay(ctx, width, height, { dateLabel, timeLabel, place, coordsLabel, viewDirection, moon: sky.moon });
  drawCompass(ctx, width, height, proj, viewAzimuth);
}

function drawSkyGradient(ctx, width, height, horizonY, lightPollution) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, '#02040c');
  g.addColorStop(0.55, '#050b1b');
  g.addColorStop(1, `rgb(${Math.round(10 + 40 * lightPollution)}, ${Math.round(16 + 34 * lightPollution)}, ${Math.round(32 + 40 * lightPollution)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Atmospheric haze just above the horizon.
  const haze = ctx.createLinearGradient(0, horizonY - height * 0.22, 0, horizonY);
  haze.addColorStop(0, 'rgba(90, 110, 150, 0)');
  haze.addColorStop(1, `rgba(150, 130, 110, ${0.12 + 0.35 * lightPollution})`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY - height * 0.22, width, height * 0.22);
}

function drawMilkyWay(ctx, proj, points, lightPollution) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const visibility = Math.max(0.15, 1 - lightPollution * 1.2);
  for (const p of points) {
    if (p.alt < 0) continue;
    const { x, y, dx } = proj.project(p.alt, p.az);
    if (Math.abs(dx) > HORIZONTAL_FOV / 2 + 5) continue;
    const alpha = p.density * 0.1 * visibility * Math.min(1, p.alt / 12 + 0.2);
    if (alpha <= 0.002) continue;
    const r = proj.scale * 3.2;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(198, 206, 235, ${alpha})`);
    grad.addColorStop(1, 'rgba(198, 206, 235, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function drawConstellations(ctx, proj, lines, width) {
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 160, 220, 0.16)';
  ctx.lineWidth = Math.max(1, width / 1600);
  for (const line of lines) {
    let previous = null;
    for (const point of line) {
      if (point.alt < 0) {
        previous = null;
        continue;
      }
      const p = proj.project(point.alt, point.az);
      if (Math.abs(p.dx) > HORIZONTAL_FOV / 2) {
        previous = null;
        continue;
      }
      if (previous) {
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      previous = p;
    }
  }
  ctx.restore();
}

function starRadius(mag, scale) {
  const size = Math.max(0.4, (6.8 - mag) * 0.42);
  return size * (scale / 13);
}

function drawStars(ctx, proj, stars, height, lightPollution, showLabels) {
  const limit = 6.5 - lightPollution * 2.2;
  ctx.save();
  for (const s of stars) {
    if (s.alt < 0 || s.mag > limit) continue;
    const { x, y, dx } = proj.project(s.alt, s.az);
    if (Math.abs(dx) > HORIZONTAL_FOV / 2 || y < -10) continue;

    // Extinction close to the horizon.
    const extinction = Math.min(1, 0.25 + s.alt / 25);
    const alpha = Math.max(0, Math.min(1, 0.25 + (limit - s.mag) / 2.6)) * extinction;
    if (alpha <= 0.02) continue;
    const r = starRadius(s.mag, proj.scale);
    ctx.fillStyle = bvToColor(s.bv);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (s.mag < 1.6) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 6, 0, Math.PI * 2);
      ctx.fill();

      if (showLabels && s.name) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = 'rgba(220, 232, 255, 0.9)';
        ctx.font = `${Math.round(height / 68)}px "Helvetica Neue", Arial, sans-serif`;
        ctx.fillText(s.name, x + r * 5, y - r * 4);
      }
    }
  }
  ctx.restore();
}

function drawPlanets(ctx, proj, planets, height, showLabels) {
  ctx.save();
  for (const p of planets) {
    if (p.alt < 0) continue;
    const { x, y, dx } = proj.project(p.alt, p.az);
    if (Math.abs(dx) > HORIZONTAL_FOV / 2) continue;
    const r = starRadius(p.mag, proj.scale) * 1.15;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    glow.addColorStop(0, 'rgba(255, 250, 235, 0.4)');
    glow.addColorStop(1, 'rgba(255, 250, 235, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (showLabels) {
      ctx.fillStyle = 'rgba(235, 225, 205, 0.85)';
      ctx.font = `${Math.round(height / 62)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillText(p.name, x + r * 4, y - r * 3);
    }
  }
  ctx.restore();
}

function drawMoon(ctx, proj, moon, scale) {
  if (!moon || moon.alt < -1) return;
  const { x, y, dx } = proj.project(moon.alt, moon.az);
  if (Math.abs(dx) > HORIZONTAL_FOV / 2 + 2) return;

  const angularRadius = ((180 / Math.PI) * Math.asin(1737.4 / moon.distanceKm)) * MOON_EXAGGERATION;
  const r = Math.max(6, angularRadius * scale);

  ctx.save();
  const halo = ctx.createRadialGradient(x, y, r, x, y, r * 6);
  halo.addColorStop(0, `rgba(215, 225, 245, ${0.16 * moon.illumination + 0.02})`);
  halo.addColorStop(1, 'rgba(215, 225, 245, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 6, 0, Math.PI * 2);
  ctx.fill();

  // Earthshine on the unlit portion.
  ctx.fillStyle = 'rgba(90, 96, 116, 0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Lit portion: a half disc combined with the terminator ellipse.
  const k = moon.illumination;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-moon.brightLimbAngle * DEG);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, r * Math.abs(1 - 2 * k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0.5);
  ctx.closePath();
  const lit = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  lit.addColorStop(0, '#fbf7ea');
  lit.addColorStop(1, '#ded6c2');
  ctx.fillStyle = lit;
  ctx.fill();
  ctx.restore();

  // Subtle maria so the disc does not look flat.
  ctx.globalAlpha = 0.1 * k;
  ctx.fillStyle = '#8d8878';
  for (const [mx, my, mr] of [[-0.25, -0.2, 0.3], [0.2, -0.35, 0.18], [0.15, 0.3, 0.22], [-0.35, 0.25, 0.14]]) {
    ctx.beginPath();
    ctx.arc(x + mx * r, y + my * r, mr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Deterministic pseudo-random generator so a place always gets the same horizon.
function makeRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function drawHorizon(ctx, width, height, horizonY, lightPollution, seed) {
  const rand = makeRandom(seed);

  // Ground glow from settlements along the horizon.
  const glowCount = Math.round(2 + lightPollution * 8);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < glowCount; i++) {
    const gx = rand() * width;
    const gr = width * (0.06 + rand() * 0.12);
    const grad = ctx.createRadialGradient(gx, horizonY, 0, gx, horizonY, gr);
    grad.addColorStop(0, `rgba(226, 170, 104, ${0.06 + lightPollution * 0.18})`);
    grad.addColorStop(1, 'rgba(226, 170, 104, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, horizonY, gr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Terrain silhouette.
  ctx.save();
  ctx.fillStyle = '#04060a';
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, horizonY);
  const step = width / 60;
  let y = horizonY;
  for (let x = 0; x <= width; x += step) {
    y = horizonY - (Math.sin(x / (width / 6) + seed) * 0.4 + rand() * 0.6) * height * 0.02;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Buildings, denser where there is more light pollution.
  const buildings = Math.round(lightPollution * 34);
  for (let i = 0; i < buildings; i++) {
    const bw = width * (0.008 + rand() * 0.022);
    const bh = height * (0.01 + rand() * 0.075) * (0.4 + lightPollution);
    const bx = rand() * width;
    ctx.fillStyle = '#04060a';
    ctx.fillRect(bx, horizonY - bh, bw, bh + height * 0.05);
    ctx.fillStyle = `rgba(255, 205, 130, ${0.25 + lightPollution * 0.4})`;
    for (let wY = horizonY - bh + bh * 0.15; wY < horizonY - bh * 0.1; wY += bh * 0.22) {
      for (let wX = bx + bw * 0.2; wX < bx + bw * 0.85; wX += bw * 0.3) {
        if (rand() > 0.55) ctx.fillRect(wX, wY, bw * 0.12, bh * 0.07);
      }
    }
  }
  ctx.restore();
}

function drawOverlay(ctx, width, height, info) {
  const pad = width * 0.028;
  const titleSize = Math.round(height / 20);
  const bodySize = Math.round(height / 38);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = `300 ${titleSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Night Sky on ${info.dateLabel}`, pad, pad + titleSize);

  ctx.font = `300 ${bodySize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(232, 238, 250, 0.82)';
  const lines = [
    `Date: ${info.dateLabel}`,
    `Time: ${info.timeLabel} Local Time`,
    `Location: ${info.place}`,
    `Coordinates: ${info.coordsLabel}`,
    '',
    `View: Facing ${directionName(info.viewDirection)}`,
    `Moon: ${info.moon.phaseName} · ${(info.moon.illumination * 100).toFixed(0)}% illuminated`,
  ];
  let y = pad + titleSize + bodySize * 1.8;
  for (const line of lines) {
    if (line) ctx.fillText(line, pad, y);
    y += bodySize * 1.45;
  }
  ctx.restore();
}

function directionName(code) {
  return (
    {
      N: 'North', NE: 'North-East', E: 'East', SE: 'South-East',
      S: 'South', SW: 'South-West', W: 'West', NW: 'North-West',
    }[code] || code
  );
}

function drawCompass(ctx, width, height, proj, viewAzimuth) {
  const y = height * 0.965;
  const size = Math.round(height / 40);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = Math.max(1, height / 900);
  ctx.beginPath();
  ctx.moveTo(width * 0.08, y);
  ctx.lineTo(width * 0.92, y);
  ctx.stroke();

  ctx.font = `300 ${size}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  for (const [az, label] of COMPASS_POINTS) {
    const p = proj.project(0, az);
    if (Math.abs(p.dx) > HORIZONTAL_FOV / 2 - 3) continue;
    ctx.fillStyle = az === viewAzimuth ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(label, p.x, y - size * 0.6);
    ctx.beginPath();
    ctx.moveTo(p.x, y - size * 0.35);
    ctx.lineTo(p.x, y + size * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

/** Human readable coordinate string for the overlay. */
export function coordinatesLabel(latitude, longitude) {
  return `${formatCoord(latitude, 'N', 'S')}, ${formatCoord(longitude, 'E', 'W')}`;
}

export { HORIZONTAL_FOV, RAD };
