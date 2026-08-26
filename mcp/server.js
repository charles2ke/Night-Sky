#!/usr/bin/env node
// Model Context Protocol server exposing the Night Sky astronomy engine over
// stdio. It reuses the same modules as the web app (src/astro.js,
// src/geocode.js, src/render.js) so the numbers an assistant gets back match
// what the site draws.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  equatorialToHorizontal,
  formatOffset,
  julianDay,
  lmst,
  localToUtc,
  moonPhase,
  precessFromJ2000,
} from '../src/astro.js';
import { daysUntil, eclipseEmoji, formatEclipseDate, splitEclipses } from '../src/eclipses.js';
import { galaxyIndex, imageUrl, matchGalaxy, sourceUrl } from '../src/galaxies.js';
import { resolvePlace } from '../src/geocode.js';
import { eventsOnDay, monthDayLabel } from '../src/onthisday.js';
import { DIRECTIONS, computeSky, coordinatesLabel } from '../src/render.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PANORAMA_HALF_FOV = 70; // computeSky's panorama spans 140 degrees

let catalogPromise = null;
const dataPromises = new Map();

/** Read and cache one of the JSON files in `data/`. */
function loadData(name) {
  if (!dataPromises.has(name)) {
    dataPromises.set(name, readFile(join(ROOT, 'data', `${name}.json`), 'utf8').then(JSON.parse));
  }
  return dataPromises.get(name);
}

/** Load and cache the star catalogue and constellation lines from `data/`. */
function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      readFile(join(ROOT, 'data', 'stars.json'), 'utf8').then(JSON.parse),
      readFile(join(ROOT, 'data', 'constellations.json'), 'utf8').then(JSON.parse),
    ]).then(([stars, constellations]) => ({ stars, constellations }));
  }
  return catalogPromise;
}

const round = (value, digits = 2) => Number(value.toFixed(digits));
const angleDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

const locationShape = {
  place: z
    .string()
    .optional()
    .describe('Place name (e.g. "Al Ain, UAE") or raw coordinates ("-24.5, -69.25")'),
  latitude: z.number().min(-90).max(90).optional().describe('Latitude in degrees, north positive'),
  longitude: z.number().min(-180).max(180).optional().describe('Longitude in degrees, east positive'),
  timezone: z
    .string()
    .optional()
    .describe('IANA time zone for the local time; defaults to the place time zone, then to a longitude estimate'),
};

const momentShape = {
  date: z.string().regex(/^-?\d{1,6}-\d{2}-\d{2}$/).describe('Local date as YYYY-MM-DD'),
  time: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .optional()
    .describe('Local 24-hour time as HH:MM (defaults to 00:00)'),
};

/**
 * Turn the location arguments into a place record. Explicit coordinates win,
 * otherwise the place name is geocoded exactly as the web app does.
 */
async function resolveLocation({ place, latitude, longitude, timezone }) {
  if (latitude !== undefined && longitude !== undefined) {
    return {
      label: place || coordinatesLabel(latitude, longitude),
      latitude,
      longitude,
      timezone: timezone || null,
      population: 0,
      source: 'coordinates',
    };
  }
  if (latitude !== undefined || longitude !== undefined) {
    throw new Error('Provide both latitude and longitude, or a place name.');
  }
  if (!place) throw new Error('Provide a place name, or a latitude and longitude pair.');
  const resolved = await resolvePlace(place);
  return { ...resolved, timezone: timezone || resolved.timezone || null };
}

/** Resolve place plus local date and time into the UTC instant to compute for. */
async function resolveMoment(args) {
  const location = await resolveLocation(args);
  const { date, offsetMinutes } = localToUtc(args.date, args.time, location.timezone, location.longitude);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date or time: "${args.date} ${args.time || '00:00'}".`);
  }
  return {
    location,
    instant: date,
    when: {
      localDate: args.date,
      localTime: args.time || '00:00',
      utc: date.toISOString(),
      utcOffset: formatOffset(offsetMinutes),
      timeZone: location.timezone || 'estimated from longitude',
      julianDay: round(julianDay(date), 5),
    },
  };
}

function describeLocation(location) {
  return {
    label: location.label || location.name,
    latitude: round(location.latitude, 4),
    longitude: round(location.longitude, 4),
    timeZone: location.timezone || null,
    population: location.population || 0,
    source: location.source,
  };
}

function describeMoon(moon) {
  return {
    phase: moon.phaseName,
    illuminationPercent: round(moon.illumination * 100, 1),
    waxing: moon.waxing,
    ageDays: round(moon.age, 2),
    rightAscension: round(moon.ra, 3),
    declination: round(moon.dec, 3),
    distanceKm: Math.round(moon.distanceKm),
  };
}

const position = (object) => ({ altitude: round(object.alt), azimuth: round(object.az) });

const jsonResult = (payload) => ({
  content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  structuredContent: payload,
});

const server = new McpServer({ name: 'night-sky', version: '1.0.0' });

server.registerTool(
  'resolve_place',
  {
    title: 'Resolve a place',
    description:
      'Resolve a place name or a "latitude, longitude" string to coordinates, time zone and population, using the same geocoder as the web app.',
    inputSchema: { query: z.string().min(1).describe('Place name or "latitude, longitude"') },
  },
  async ({ query }) => jsonResult({ place: describeLocation(await resolvePlace(query)) })
);

server.registerTool(
  'moon_phase',
  {
    title: 'Moon phase',
    description:
      'Phase name, illuminated fraction, age, distance and position of the Moon for a local date and time at a place.',
    inputSchema: { ...locationShape, ...momentShape },
  },
  async (args) => {
    const { location, instant, when } = await resolveMoment(args);
    const jd = julianDay(instant);
    const moon = moonPhase(jd);
    const horizontal = equatorialToHorizontal(moon.ra, moon.dec, lmst(jd, location.longitude), location.latitude);
    return jsonResult({
      place: describeLocation(location),
      when,
      moon: { ...describeMoon(moon), ...position(horizontal), aboveHorizon: horizontal.alt > 0 },
    });
  }
);

server.registerTool(
  'sky_snapshot',
  {
    title: 'Night sky snapshot',
    description:
      'What is above the horizon for a place and moment: the Moon, the naked-eye planets and the brightest named stars, each with altitude and azimuth.',
    inputSchema: {
      ...locationShape,
      ...momentShape,
      facing: z
        .enum(Object.keys(DIRECTIONS))
        .optional()
        .describe('Restrict the result to the 140° panorama centred on this compass direction'),
      maxStars: z.number().int().min(1).max(200).default(20).describe('How many of the brightest named stars to return'),
      minAltitude: z.number().min(-90).max(90).default(0).describe('Ignore objects below this altitude, in degrees'),
    },
  },
  async (args) => {
    const { location, instant, when } = await resolveMoment(args);
    const { stars, constellations } = await loadCatalog();
    const sky = computeSky({
      date: instant,
      latitude: location.latitude,
      longitude: location.longitude,
      stars,
      constellations,
    });

    const viewAzimuth = args.facing ? DIRECTIONS[args.facing] : null;
    const inView = (object) =>
      object.alt >= args.minAltitude &&
      (viewAzimuth === null || Math.abs(angleDiff(object.az, viewAzimuth)) <= PANORAMA_HALF_FOV);

    return jsonResult({
      place: describeLocation(location),
      when: { ...when, localSiderealTimeDegrees: round(sky.siderealTime, 3) },
      facing: args.facing || 'all directions',
      moon: { ...describeMoon(sky.moon), ...position(sky.moon), inView: inView(sky.moon) },
      planets: sky.planets
        .filter(inView)
        .map((p) => ({ name: p.name, magnitude: p.mag, ...position(p) }))
        .sort((a, b) => b.altitude - a.altitude),
      stars: sky.stars
        .filter((s) => s.name && inView(s))
        .sort((a, b) => a.mag - b.mag)
        .slice(0, args.maxStars)
        .map((s) => ({ name: s.name, magnitude: s.mag, ...position(s) })),
      starsAboveMinAltitude: sky.stars.filter((s) => s.alt >= args.minAltitude).length,
    });
  }
);

server.registerTool(
  'visible_constellations',
  {
    title: 'Visible constellations',
    description:
      'Constellations whose figures are above the horizon for a place and moment, with the altitude and azimuth of their centre.',
    inputSchema: {
      ...locationShape,
      ...momentShape,
      minAltitude: z.number().min(-90).max(90).default(0).describe('Ignore constellations centred below this altitude'),
    },
  },
  async (args) => {
    const { location, instant, when } = await resolveMoment(args);
    const { constellations } = await loadCatalog();
    const jd = julianDay(instant);
    const st = lmst(jd, location.longitude);

    const visible = [];
    for (const constellation of constellations) {
      let count = 0;
      let above = 0;
      let altSum = 0;
      let x = 0;
      let y = 0;
      for (const line of constellation.lines) {
        for (const [ra, dec] of line) {
          const p = precessFromJ2000(ra, dec, jd);
          const h = equatorialToHorizontal(p.ra, p.dec, st, location.latitude);
          count += 1;
          if (h.alt < 0) continue;
          above += 1;
          altSum += h.alt;
          x += Math.cos((h.az * Math.PI) / 180);
          y += Math.sin((h.az * Math.PI) / 180);
        }
      }
      if (!above) continue;
      const altitude = altSum / above;
      if (altitude < args.minAltitude) continue;
      visible.push({
        abbreviation: constellation.id,
        altitude: round(altitude),
        azimuth: round((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360),
        fractionAboveHorizon: round(above / count, 2),
      });
    }
    visible.sort((a, b) => b.altitude - a.altitude);

    return jsonResult({ place: describeLocation(location), when, constellations: visible });
  }
);

server.registerTool(
  'eclipses',
  {
    title: 'Solar and lunar eclipses',
    description:
      'Upcoming and past eclipses from the same NASA-derived catalogue as the eclipses page, split around a reference date.',
    inputSchema: {
      kind: z.enum(['all', 'solar', 'lunar']).default('all').describe('Restrict the catalogue to one kind of eclipse'),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Reference date as YYYY-MM-DD (defaults to today, UTC)'),
      upcoming: z.number().int().min(0).max(50).default(5).describe('How many future eclipses to return'),
      past: z.number().int().min(0).max(50).default(3).describe('How many past eclipses to return'),
    },
  },
  async (args) => {
    const { eclipses, source, note } = await loadData('eclipses');
    const reference = args.date ? new Date(`${args.date}T00:00:00Z`) : new Date();
    if (Number.isNaN(reference.getTime())) throw new Error(`Invalid date: "${args.date}".`);

    const matching = eclipses.filter((e) => args.kind === 'all' || e.kind === args.kind);
    const { upcoming, past } = splitEclipses(matching, reference);
    const describeEclipse = (eclipse) => ({
      date: eclipse.date,
      dateLabel: formatEclipseDate(eclipse.date),
      greatestEclipseUtc: eclipse.time || null,
      kind: eclipse.kind,
      type: eclipse.type,
      emoji: eclipseEmoji(eclipse),
      magnitude: eclipse.magnitude ?? null,
      duration: eclipse.duration || null,
      regions: eclipse.regions,
      notes: eclipse.notes || null,
      daysFromReference: daysUntil(eclipse, reference),
    });

    return jsonResult({
      catalogue: { source, note, entries: eclipses.length },
      reference: { date: reference.toISOString().slice(0, 10), kind: args.kind },
      upcoming: upcoming.slice(0, args.upcoming).map(describeEclipse),
      past: past.slice(0, args.past).map(describeEclipse),
      totals: { upcoming: upcoming.length, past: past.length },
    });
  }
);

server.registerTool(
  'on_this_day',
  {
    title: 'On this day',
    description:
      'World events that share a month and day with the given date and happened on or before it, exactly as the "On this day" section of the site shows them.',
    inputSchema: {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date as YYYY-MM-DD'),
      limit: z.number().int().min(1).max(50).default(6).describe('How many events to return, most recent first'),
    },
  },
  async (args) => {
    const { events, source, note } = await loadData('events');
    return jsonResult({
      catalogue: { source, note, entries: events.length },
      date: args.date,
      dayLabel: monthDayLabel(args.date),
      events: eventsOnDay(events, args.date, args.limit).map((event) => ({
        date: event.date,
        year: Number(event.date.slice(0, 4)),
        category: event.category || null,
        title: event.title,
        description: event.description || null,
      })),
    });
  }
);

server.registerTool(
  'galaxies',
  {
    title: 'Galaxy guide',
    description:
      'The galaxies covered by the site: the whole list, or the facts, summary and image credits for the one whose name matches a query.',
    inputSchema: {
      query: z.string().optional().describe('Galaxy name or part of one, e.g. "Andromeda"; omit to list every galaxy'),
    },
  },
  async (args) => {
    const data = await loadData('galaxies');
    const index = galaxyIndex(data);
    const describeImage = (image) =>
      image && {
        url: imageUrl(image.file, image.width || 900),
        source: sourceUrl(image.file),
        alt: image.alt,
        caption: image.caption || null,
        credit: image.credit,
        license: image.license,
        licenseUrl: image.licenseUrl,
      };
    const describeGalaxy = (galaxy) => ({
      id: galaxy.id,
      name: galaxy.name,
      designation: galaxy.designation,
      type: galaxy.type,
      constellation: galaxy.constellation,
      distance: galaxy.distance,
      diameter: galaxy.diameter,
      magnitude: galaxy.magnitude || null,
      group: galaxy.group || null,
      stars: galaxy.stars || null,
      discovery: galaxy.discovery || null,
      summary: galaxy.summary,
      highlights: galaxy.highlights || [],
      images: (galaxy.gallery || [galaxy.image]).filter(Boolean).map(describeImage),
    });

    const all = [{ ...data.home, id: 'milky-way' }, ...data.galaxies];
    if (!args.query) {
      return jsonResult({
        count: all.length,
        galaxies: all.map((galaxy) => ({
          id: galaxy.id,
          name: galaxy.name,
          designation: galaxy.designation,
          type: galaxy.type,
          constellation: galaxy.constellation,
          distance: galaxy.distance,
        })),
      });
    }

    const id = matchGalaxy(args.query, index);
    if (!id) {
      throw new Error(`No galaxy matches "${args.query}". Known galaxies: ${index.map((e) => e.name).join(', ')}.`);
    }
    return jsonResult({ query: args.query, galaxy: describeGalaxy(all.find((galaxy) => galaxy.id === id)) });
  }
);

await server.connect(new StdioServerTransport());
