// Renders the galaxy information page from data/galaxies.json.
const COMMONS_FILE_PATH = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const COMMONS_FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:';

/** Wikimedia Commons thumbnail URL for a freely licensed file. */
export function imageUrl(file, width = 900) {
  const name = String(file).replace(/ /g, '_');
  return `${COMMONS_FILE_PATH}${encodeURIComponent(name)}?width=${width}`;
}

/** Commons description page, where the licence and author are documented. */
export function sourceUrl(file) {
  return `${COMMONS_FILE_PAGE}${encodeURIComponent(String(file).replace(/ /g, '_'))}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Figure with the image plus its author and licence, as the licences require. */
function buildFigure(image, { width, caption } = {}) {
  const figure = el('figure', 'shot');
  const img = el('img');
  img.src = imageUrl(image.file, width || image.width || 900);
  img.alt = image.alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  // If the image cannot be loaded (offline, or the file was renamed) keep the
  // layout intact and show the placeholder background instead of a broken icon.
  img.addEventListener('error', () => figure.classList.add('shot--unavailable'));
  figure.append(img);

  const figcaption = el('figcaption');
  if (caption) figcaption.append(el('span', 'shot-caption', caption));

  const credit = el('span', 'credit');
  credit.append(document.createTextNode('Image: '));
  const source = el('a', null, image.credit);
  source.href = sourceUrl(image.file);
  source.rel = 'noopener noreferrer';
  credit.append(source, document.createTextNode(' — '));
  const licence = el('a', null, image.license);
  licence.href = image.licenseUrl;
  licence.rel = 'noopener noreferrer';
  credit.append(licence);

  figcaption.append(credit);
  figure.append(figcaption);
  return figure;
}

function buildFacts(pairs) {
  const dl = el('dl', 'facts');
  for (const [term, value] of pairs) {
    if (!value) continue;
    dl.append(el('dt', null, term), el('dd', null, value));
  }
  return dl;
}

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
