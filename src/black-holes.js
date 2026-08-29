// Renders the black hole guide from data/black-holes.json: a scale diagram of
// the event horizons, then a card for every black hole grouped by class.
import { buildFacts, buildFigure, el, svgEl } from './commons.js';

const DIAGRAM = { width: 1000, height: 210 };

/** Human-readable size of an event horizon, from kilometres to astronomical units. */
export function formatHorizon(km) {
  if (!Number.isFinite(km)) return '';
  if (km >= 1e9) return `${(km / 149597870.7).toLocaleString('en-GB', { maximumFractionDigits: 1 })} AU across`;
  if (km >= 1e6) return `${(km / 1e6).toLocaleString('en-GB', { maximumFractionDigits: 1 })} million km across`;
  return `${km.toLocaleString('en-GB', { maximumFractionDigits: 0 })} km across`;
}

/**
 * Event horizons span twenty orders of magnitude, so the bars use a logarithmic
 * scale: each step along the axis is a factor of ten in size.
 */
export function buildHorizonDiagram(blackHoles) {
  const sized = blackHoles.filter((hole) => Number.isFinite(hole.horizonKm) && hole.horizonKm > 0);
  const svg = svgEl('svg', {
    class: 'scale-diagram horizon-diagram',
    viewBox: `0 0 ${DIAGRAM.width} ${Math.max(DIAGRAM.height, sized.length * 26 + 40)}`,
    role: 'img',
    'aria-label':
      'Logarithmic comparison of the event horizon diameters of the black holes on this page, from a few dozen kilometres to hundreds of billions of kilometres.',
  });
  if (!sized.length) return svg;

  const left = 190;
  const right = DIAGRAM.width - 150;
  const min = Math.log10(Math.min(...sized.map((hole) => hole.horizonKm)));
  const max = Math.log10(Math.max(...sized.map((hole) => hole.horizonKm)));
  const span = Math.max(max - min, 1);
  const length = (km) => Math.max(6, ((Math.log10(km) - min) / span) * (right - left));

  sized
    .slice()
    .sort((a, b) => a.horizonKm - b.horizonKm)
    .forEach((hole, index) => {
      const y = 24 + index * 26;
      svg.append(
        svgEl('text', { class: 'diagram-label', x: left - 12, y: y + 4, 'text-anchor': 'end' }, hole.name),
        svgEl('rect', {
          class: 'horizon-bar',
          'data-class': hole.class,
          x: left,
          y: y - 8,
          width: length(hole.horizonKm),
          height: 16,
          rx: 8,
        }),
        svgEl(
          'text',
          { class: 'diagram-value', x: left + length(hole.horizonKm) + 10, y: y + 4 },
          formatHorizon(hole.horizonKm)
        )
      );
    });
  return svg;
}

function buildCard(hole, classNames) {
  const card = el('details', 'black-hole-card');
  card.id = hole.id;
  card.dataset.class = hole.class;

  const summary = el('summary', 'black-hole-summary');
  const badge = el('span', 'badge', classNames.get(hole.class) || hole.class);
  badge.dataset.class = hole.class;
  summary.append(el('h3', null, hole.name), el('p', 'eyebrow', hole.designation), badge);
  card.append(summary);
  card.append(buildFigure(hole.image, { width: 900 }));

  const body = el('div', 'black-hole-body');
  body.append(el('p', null, hole.summary));
  body.append(
    buildFacts([
      ['Class', classNames.get(hole.class) || hole.class],
      ['Mass', hole.mass],
      ['Event horizon', formatHorizon(hole.horizonKm)],
      ['Distance', hole.distance],
      ['Constellation', hole.constellation],
      ['Galaxy', hole.galaxy],
      ['Known since', hole.discovery],
    ])
  );
  card.append(body);
  return card;
}

function buildClassLegend(classes) {
  const list = el('dl', 'class-legend');
  for (const item of classes) {
    const term = el('dt', null, `${item.name} · ${item.range}`);
    term.dataset.class = item.id;
    list.append(term, el('dd', null, item.description));
  }
  return list;
}

export function renderBlackHoles(data, { intro, legend, diagram, grid, count }) {
  const classNames = new Map(data.classes.map((item) => [item.id, item.name]));
  if (intro) intro.textContent = data.intro;
  if (legend) legend.replaceChildren(buildClassLegend(data.classes));
  if (diagram) diagram.replaceChildren(buildHorizonDiagram(data.blackHoles));
  if (grid) grid.replaceChildren(...data.blackHoles.map((hole) => buildCard(hole, classNames)));
  if (count) count.textContent = `${data.blackHoles.length} black holes, from collapsed stars to the giants at the hearts of galaxies.`;
}

/** Hides the cards that do not belong to the selected class. */
export function applyFilter(wanted, doc = document) {
  let shown = 0;
  for (const card of doc.querySelectorAll('.black-hole-card')) {
    const matches = !wanted || wanted === 'all' || card.dataset.class === wanted;
    card.hidden = !matches;
    if (matches) shown += 1;
  }
  return shown;
}

async function init() {
  const status = document.getElementById('status');
  const targets = {
    intro: document.getElementById('black-hole-intro'),
    legend: document.getElementById('class-legend'),
    diagram: document.getElementById('horizon-diagram'),
    grid: document.getElementById('black-hole-grid'),
    count: document.getElementById('black-hole-count'),
  };
  if (!targets.grid) return;

  try {
    const response = await fetch('./data/black-holes.json');
    if (!response.ok) throw new Error(`Could not load black hole data (${response.status})`);
    const data = await response.json();
    renderBlackHoles(data, targets);
    for (const input of document.querySelectorAll('input[name="hole-class"]')) {
      input.addEventListener('change', () => applyFilter(input.value));
    }
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
  } catch (error) {
    if (status) {
      status.textContent = error instanceof Error ? error.message : 'Could not load black hole data.';
      status.dataset.state = 'error';
    }
  }
}

if (typeof document !== 'undefined') init();
