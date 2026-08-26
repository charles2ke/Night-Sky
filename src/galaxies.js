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
  const article = el('article', 'home-galaxy');

  const header = el('header', 'home-galaxy-header');
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
  const card = el('article', 'galaxy-card');
  card.id = galaxy.id;
  card.append(buildFigure(galaxy.image, { width: 900 }));

  const body = el('div', 'galaxy-card-body');
  body.append(el('h3', null, galaxy.name), el('p', 'eyebrow', galaxy.designation));
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

export function renderGalaxies(data, { home, grid, count }) {
  home.replaceChildren(buildHome(data.home));
  grid.replaceChildren(...data.galaxies.map(buildCard));
  if (count) {
    count.textContent = `${data.galaxies.length + 1} galaxies and deep-sky views, starting with our own.`;
  }
}

async function init() {
  const status = document.getElementById('status');
  const targets = {
    home: document.getElementById('milky-way'),
    grid: document.getElementById('galaxy-grid'),
    count: document.getElementById('galaxy-count'),
  };
  if (!targets.home || !targets.grid) return;

  try {
    const response = await fetch('./data/galaxies.json');
    if (!response.ok) throw new Error(`Could not load galaxy data (${response.status})`);
    renderGalaxies(await response.json(), targets);
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

if (typeof document !== 'undefined') init();
