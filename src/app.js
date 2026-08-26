// Wires the form to the astronomy engine and the canvas renderer.
import { formatOffset, localToUtc } from './astro.js';
import { resolvePlace } from './geocode.js';
import { loadEvents, renderOnThisDay } from './onthisday.js';
import { computeSky, coordinatesLabel, renderSky } from './render.js';

const els = {
  form: document.getElementById('sky-form'),
  place: document.getElementById('place'),
  date: document.getElementById('date'),
  time: document.getElementById('time'),
  direction: document.getElementById('direction'),
  button: document.getElementById('generate'),
  canvas: document.getElementById('sky-canvas'),
  status: document.getElementById('status'),
  constellations: document.getElementById('toggle-constellations'),
  labels: document.getElementById('toggle-labels'),
  lightPollution: document.getElementById('light-pollution'),
  details: document.getElementById('details'),
  detailsList: document.getElementById('details-list'),
  download: document.getElementById('download'),
  onThisDay: document.getElementById('on-this-day'),
  onThisDayHeading: document.getElementById('on-this-day-heading'),
  eventsList: document.getElementById('events-list'),
};

let catalog = null;
let lastRender = null;

async function loadCatalog() {
  if (catalog) return catalog;
  const [stars, constellations] = await Promise.all([
    fetch('./data/stars.json').then((r) => r.json()),
    fetch('./data/constellations.json').then((r) => r.json()),
  ]);
  catalog = { stars, constellations };
  return catalog;
}

function setStatus(message, state = '') {
  els.status.textContent = message;
  if (state) els.status.dataset.state = state;
  else delete els.status.dataset.state;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** Estimate how bright the local sky glow is for a place and year. */
export function estimateLightPollution(population, year) {
  const urban = Math.min(1, Math.log10((population || 0) + 10) / 7.2);
  const era = Math.min(1, Math.max(0, (year - 1880) / 145));
  return Math.min(0.9, 0.05 + urban * era * 0.95);
}

function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function draw() {
  if (!lastRender) return;
  const { sky, options } = lastRender;
  renderSky(els.canvas, sky, {
    ...options,
    showConstellations: els.constellations.checked,
    showLabels: els.labels.checked,
    lightPollution: Number(els.lightPollution.value) / 100,
  });
  els.download.href = els.canvas.toDataURL('image/png');
  els.download.hidden = false;
}

function showDetails(rows) {
  els.detailsList.replaceChildren();
  for (const [term, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    els.detailsList.append(dt, dd);
  }
  els.details.hidden = false;
}

async function generate(event) {
  if (event) event.preventDefault();
  els.button.disabled = true;
  try {
    setStatus('Looking up the place…');
    const place = await resolvePlace(els.place.value);

    setStatus('Computing the sky…');
    const { stars, constellations } = await loadCatalog();
    const dateStr = els.date.value;
    const timeStr = els.time.value || '00:00';
    const { date, offsetMinutes } = localToUtc(dateStr, timeStr, place.timezone, place.longitude);
    if (Number.isNaN(date.getTime())) throw new Error('Please enter a valid date and time.');

    const sky = computeSky({
      date,
      latitude: place.latitude,
      longitude: place.longitude,
      stars,
      constellations,
    });

    const year = Number(dateStr.split('-')[0]);
    const pollution = estimateLightPollution(place.population, year);
    els.lightPollution.value = String(Math.round(pollution * 100));

    lastRender = {
      sky,
      options: {
        viewDirection: els.direction.value,
        place: place.label || place.name,
        dateLabel: formatDate(dateStr),
        timeLabel: timeStr,
        coordsLabel: coordinatesLabel(place.latitude, place.longitude),
        terrainSeed: seedFrom(`${place.label || place.name}`),
      },
    };
    draw();

    const visible = sky.stars.filter((s) => s.alt > 0).length;
    const planetsUp = sky.planets.filter((p) => p.alt > 0).map((p) => p.name);
    showDetails([
      ['Location', `${place.label || place.name} (${coordinatesLabel(place.latitude, place.longitude)})`],
      ['Local time', `${formatDate(dateStr)}, ${timeStr} (${formatOffset(offsetMinutes)})`],
      ['UTC', date.toISOString().replace('.000Z', 'Z')],
      ['Moon phase', `${sky.moon.phaseName}, ${(sky.moon.illumination * 100).toFixed(1)}% illuminated`],
      ['Moon altitude', `${sky.moon.alt.toFixed(1)}° ${sky.moon.alt > 0 ? 'above' : 'below'} the horizon`],
      ['Stars above the horizon', String(visible)],
      ['Planets above the horizon', planetsUp.length ? planetsUp.join(', ') : 'none'],
      ['Place lookup', place.source],
    ]);
    const events = await loadEvents();
    renderOnThisDay(
      { section: els.onThisDay, heading: els.onThisDayHeading, list: els.eventsList },
      events,
      dateStr
    );

    setStatus(`Night sky over ${place.label || place.name} on ${formatDate(dateStr)}.`);
  } catch (error) {
    setStatus(error.message || String(error), 'error');
  } finally {
    els.button.disabled = false;
  }
}

els.form.addEventListener('submit', generate);
for (const el of [els.constellations, els.labels, els.lightPollution]) {
  el.addEventListener('input', draw);
}
els.direction.addEventListener('change', () => {
  if (lastRender) {
    lastRender.options.viewDirection = els.direction.value;
    draw();
  }
});

// Render an initial sky so the page is never empty.
generate();
