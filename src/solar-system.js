// Renders the Solar System sub-section of the Milky Way: two scale diagrams
// (relative sizes and orbital distances) drawn from data/planets.json, plus a
// card with a photograph and the numbers for each planet.
import { buildFacts, buildFigure, el, svgEl } from './commons.js';

const SIZE_VIEW = { width: 1000, height: 260 };
const ORBIT_VIEW = { width: 1000, height: 150 };

/** Radius in pixels for the size diagram, scaled so the largest planet fits. */
function sizeScale(planets, maxRadiusPx = 70) {
  const largest = Math.max(...planets.map((planet) => planet.radiusKm));
  return (radiusKm) => Math.max(2, (radiusKm / largest) * maxRadiusPx);
}

/**
 * Planets to scale, sitting on a common baseline with the limb of the Sun on
 * the left for comparison.
 */
export function buildSizeDiagram(data) {
  const planets = data.planets;
  const scale = sizeScale(planets);
  const baseline = SIZE_VIEW.height - 60;
  const svg = svgEl('svg', {
    class: 'scale-diagram',
    viewBox: `0 0 ${SIZE_VIEW.width} ${SIZE_VIEW.height}`,
    role: 'img',
    'aria-label':
      'The eight planets drawn to scale against each other, from Mercury to Neptune, with the limb of the Sun for comparison.',
  });

  if (data.sun) {
    // The Sun is drawn at the same scale as the planets, so only the edge of
    // its disc fits on the diagram.
    const sunRadius = scale(data.sun.radiusKm);
    svg.append(
      svgEl('circle', {
        class: 'sun-limb',
        cx: 120 - sunRadius,
        cy: baseline,
        r: sunRadius,
        fill: data.sun.color || '#ffd66b',
        'fill-opacity': 0.8,
      }),
      svgEl('text', { class: 'diagram-label', x: 10, y: baseline + 22 }, `${data.sun.name} (edge)`)
    );
  }

  let x = 150;
  for (const planet of planets) {
    const r = scale(planet.radiusKm);
    x += r;
    svg.append(
      svgEl('circle', {
        class: 'planet-disc',
        'data-planet': planet.id,
        cx: x,
        cy: baseline - r,
        r,
        fill: planet.color,
      }),
      svgEl('text', { class: 'diagram-label', x, y: baseline + 22, 'text-anchor': 'middle' }, planet.name)
    );
    x += r + 26;
  }
  return svg;
}

/**
 * Orbital distances on a square-root scale — a linear track would squeeze the
 * four inner planets into a single pixel.
 */
export function buildOrbitDiagram(data) {
  const planets = data.planets;
  const furthest = Math.max(...planets.map((planet) => planet.distanceAu));
  const left = 60;
  const right = ORBIT_VIEW.width - 40;
  const y = 70;
  const position = (au) => left + (Math.sqrt(au) / Math.sqrt(furthest)) * (right - left);

  const svg = svgEl('svg', {
    class: 'scale-diagram orbit-diagram',
    viewBox: `0 0 ${ORBIT_VIEW.width} ${ORBIT_VIEW.height}`,
    role: 'img',
    'aria-label':
      'The average distance of each planet from the Sun, from Mercury at 0.4 astronomical units to Neptune at 30 astronomical units.',
  });

  svg.append(svgEl('line', { class: 'orbit-track', x1: left, y1: y, x2: right, y2: y }));
  svg.append(
    svgEl('circle', { class: 'sun-mark', cx: left, cy: y, r: 10, fill: (data.sun && data.sun.color) || '#ffd66b' }),
    svgEl('text', { class: 'diagram-label', x: left, y: y + 34, 'text-anchor': 'middle' }, 'Sun')
  );

  planets.forEach((planet, index) => {
    const cx = position(planet.distanceAu);
    const above = index % 2 === 0;
    svg.append(
      svgEl('circle', { class: 'orbit-mark', 'data-planet': planet.id, cx, cy: y, r: 7, fill: planet.color }),
      svgEl(
        'text',
        { class: 'diagram-label', x: cx, y: above ? y - 20 : y + 34, 'text-anchor': 'middle' },
        planet.name
      ),
      svgEl(
        'text',
        { class: 'diagram-value', x: cx, y: above ? y - 6 : y + 50, 'text-anchor': 'middle' },
        `${planet.distanceAu} AU`
      )
    );
  });
  return svg;
}

function buildPlanetCard(planet) {
  const card = el('details', 'planet-card');
  card.id = planet.id;

  const summary = el('summary', 'planet-card-summary');
  const swatch = el('span', 'planet-swatch');
  swatch.style.background = planet.color;
  summary.append(swatch, el('h4', null, planet.name), el('p', 'eyebrow', planet.type));
  card.append(summary);
  card.append(buildFigure(planet.image, { width: 700 }));

  const body = el('div', 'planet-card-body');
  body.append(el('p', null, planet.summary));
  body.append(
    buildFacts([
      ['Radius', `${planet.radiusKm.toLocaleString('en-GB')} km`],
      ['Distance from the Sun', planet.distanceKm],
      ['Year', planet.orbit],
      ['Day', planet.day],
      ['Moons', planet.moons],
      ['Temperature', planet.temperature],
    ])
  );
  card.append(body);
  return card;
}

/** Draws the whole sub-section into `container`. */
export function renderSolarSystem(data, container) {
  if (!container) return;
  const panel = el('details', 'solar-system-panel');
  panel.open = true;
  const summary = el('summary', 'solar-system-header');
  summary.append(
    el('p', 'eyebrow', 'Inside the Milky Way'),
    el('h3', null, 'Our planets — the Solar System')
  );
  panel.append(summary);

  const body = el('div', 'solar-system-body');
  body.append(el('p', 'section-intro', data.intro));

  const sizes = el('figure', 'diagram');
  sizes.append(el('figcaption', 'diagram-title', 'The planets to scale with each other'));
  sizes.append(buildSizeDiagram(data));
  body.append(sizes);

  const orbits = el('figure', 'diagram');
  orbits.append(
    el('figcaption', 'diagram-title', 'Average distance from the Sun (square-root scale, in astronomical units)')
  );
  orbits.append(buildOrbitDiagram(data));
  body.append(orbits);

  const grid = el('div', 'planet-grid');
  grid.append(...data.planets.map(buildPlanetCard));
  body.append(grid);

  panel.append(body);
  container.replaceChildren(panel);
}
