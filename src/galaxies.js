// Renders the galaxy information page from data/galaxies.json.
import { buildFacts, buildFigure, el, imageUrl, sourceUrl } from './commons.js';
import { renderSolarSystem } from './solar-system.js';

export { imageUrl, sourceUrl };

function buildHome(home) {
  const article = el('details', 'home-galaxy');
  article.open = true;

  const header = el('summary', 'home-galaxy-header');
  header.append(el('p', 'eyebrow', home.designation), el('h2', null, home.name));
  article.append(header, buildFigure(home.gallery[0], { width: 1600, caption: home.gallery[0].caption }));

  const body = el('div', 'home-galaxy-body');
  body.append(el('p', 'lede', home.summary));
  body.append(
    buildFacts([
      ['Type', home.type],
      ['Where to look', home.constellation],
      ['Our place in it', home.distance],
      ['Diameter', home.diameter],
      ['Stars', home.stars],
      ['Known since', home.discovery],
    ])
  );

  const list = el('ul', 'highlights');
  for (const item of home.highlights) list.append(el('li', null, item));
  body.append(list);
  article.append(body);

  const gallery = el('div', 'home-gallery');
  for (const image of home.gallery.slice(1)) {
    gallery.append(buildFigure(image, { width: 900, caption: image.caption }));
  }
  article.append(gallery);
  return article;
}

function buildCard(galaxy) {
  const card = el('details', 'galaxy-card');
  card.id = galaxy.id;

  const summary = el('summary', 'galaxy-card-summary');
  summary.append(el('h3', null, galaxy.name), el('p', 'eyebrow', galaxy.designation));
  card.append(summary);
  card.append(buildFigure(galaxy.image, { width: 900 }));

  const body = el('div', 'galaxy-card-body');
  body.append(el('p', null, galaxy.summary));
  body.append(
    buildFacts([
      ['Type', galaxy.type],
      ['Constellation', galaxy.constellation],
      ['Distance', galaxy.distance],
      ['Diameter', galaxy.diameter],
      ['Brightness', galaxy.magnitude],
      ['Group', galaxy.group],
    ])
  );
  card.append(body);
  return card;
}

export function renderGalaxies(data, { home, grid, count, search, options }) {
  home.replaceChildren(buildHome(data.home));
  grid.replaceChildren(...data.galaxies.map(buildCard));
  if (count) {
    count.textContent = `${data.galaxies.length + 1} galaxies and deep-sky views, starting with our own.`;
  }
  if (options) {
    options.replaceChildren(
      ...galaxyIndex(data).map(({ id, name }) => {
        const option = el('option');
        option.value = name;
        option.dataset.target = id;
        return option;
      })
    );
  }
  if (search) search.hidden = false;
}

/** Every galaxy on the page, in the order it is rendered, for the search box. */
export function galaxyIndex(data) {
  return [
    { id: 'milky-way', name: data.home.name },
    ...data.galaxies.map((galaxy) => ({ id: galaxy.id, name: galaxy.name })),
  ];
}

/** The id of the galaxy whose name matches the query, or null when none does. */
export function matchGalaxy(query, index) {
  const wanted = String(query).trim().toLowerCase();
  if (!wanted) return null;
  const exact = index.find((entry) => entry.name.toLowerCase() === wanted);
  if (exact) return exact.id;
  const partial = index.find((entry) => entry.name.toLowerCase().includes(wanted));
  return partial ? partial.id : null;
}

/** Opens the collapsible section for a galaxy and scrolls it into view. */
export function revealGalaxy(id, doc = document) {
  const target = doc.getElementById(id);
  if (!target) return false;
  const section = target.matches('details') ? target : target.querySelector('details');
  if (section) section.open = true;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

/**
 * Scrolls to the section named in the URL. The photographs are still loading at
 * that point and push the page around as they arrive, so the scroll is repeated
 * while images settle — until the reader takes over.
 */
function followHash(target) {
  if (!revealGalaxy(target)) return;
  const settle = new AbortController();
  const { signal } = settle;
  for (const event of ['wheel', 'keydown', 'touchstart']) {
    window.addEventListener(event, () => settle.abort(), { signal });
  }
  for (const image of document.images) {
    if (!image.complete) image.addEventListener('load', () => revealGalaxy(target), { signal });
  }
  setTimeout(() => settle.abort(), 4000);
}

/** The planets are a sub-section of the Milky Way, with their own data file. */
async function loadSolarSystem(container) {
  if (!container) return;
  const response = await fetch('./data/planets.json');
  if (!response.ok) throw new Error(`Could not load planet data (${response.status})`);
  renderSolarSystem(await response.json(), container);
}

async function init() {
  const status = document.getElementById('status');
  const targets = {
    home: document.getElementById('milky-way'),
    grid: document.getElementById('galaxy-grid'),
    count: document.getElementById('galaxy-count'),
    search: document.getElementById('galaxy-search'),
    options: document.getElementById('galaxy-options'),
  };
  if (!targets.home || !targets.grid) return;

  try {
    const response = await fetch('./data/galaxies.json');
    if (!response.ok) throw new Error(`Could not load galaxy data (${response.status})`);
    const data = await response.json();
    renderGalaxies(data, targets);
    setUpSearch(data, targets.search);
    await loadSolarSystem(document.getElementById('solar-system'));
    // The sections are built after the page loads, so a link such as
    // galaxies.html#solar-system has to be followed once they exist.
    if (location.hash.length > 1) followHash(decodeURIComponent(location.hash.slice(1)));
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
  } catch (error) {
    if (status) {
      status.textContent = error instanceof Error ? error.message : 'Could not load galaxy data.';
      status.dataset.state = 'error';
    }
  }
}

function setUpSearch(data, form) {
  if (!form) return;
  const index = galaxyIndex(data);
  const input = form.querySelector('input');
  const message = form.querySelector('.search-message');

  const jump = () => {
    const id = matchGalaxy(input.value, index);
    if (id && revealGalaxy(id)) {
      if (message) message.textContent = '';
      return;
    }
    if (message) message.textContent = `No galaxy matches “${input.value.trim()}”.`;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    jump();
  });
  // Picking a name from the datalist fires `change` without submitting the form.
  input.addEventListener('change', jump);
}

if (typeof document !== 'undefined') init();
