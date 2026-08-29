// Shared helpers for the illustrated pages: Wikimedia Commons image URLs and
// the small DOM builders used by the galaxy, planet and black hole sections.
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

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Element in the SVG namespace, for the scale diagrams. */
export function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text != null) node.textContent = text;
  return node;
}

/** Figure with the image plus its author and licence, as the licences require. */
export function buildFigure(image, { width, caption } = {}) {
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

export function buildFacts(pairs) {
  const dl = el('dl', 'facts');
  for (const [term, value] of pairs) {
    if (!value) continue;
    dl.append(el('dt', null, term), el('dd', null, value));
  }
  return dl;
}
