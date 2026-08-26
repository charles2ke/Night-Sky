// Loads the eclipse catalogue and splits it into upcoming and past events.
const els = {
  status: document.getElementById('status'),
  nextUp: document.getElementById('next-up'),
  upcoming: document.getElementById('upcoming-list'),
  past: document.getElementById('past-list'),
  filters: document.querySelectorAll('input[name="kind"]'),
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** Instant of greatest eclipse, as UTC. */
export function eclipseTime(eclipse) {
  return new Date(`${eclipse.date}T${eclipse.time || '00:00'}:00Z`);
}

export function formatEclipseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Split the catalogue into future and past events, each sorted by nearness to `now`. */
export function splitEclipses(eclipses, now = new Date()) {
  const sorted = [...eclipses].sort((a, b) => eclipseTime(a) - eclipseTime(b));
  const upcoming = sorted.filter((e) => eclipseTime(e) >= now);
  const past = sorted.filter((e) => eclipseTime(e) < now).reverse();
  return { upcoming, past };
}

export function daysUntil(eclipse, now = new Date()) {
  return Math.round((eclipseTime(eclipse) - now) / 86400000);
}

function describe(eclipse) {
  return `${eclipse.type} ${eclipse.kind} eclipse`;
}

function createItem(eclipse, now) {
  const li = document.createElement('li');
  li.className = 'eclipse';
  li.dataset.kind = eclipse.kind;

  const header = document.createElement('div');
  header.className = 'eclipse-head';

  const time = document.createElement('time');
  time.className = 'eclipse-date';
  time.dateTime = eclipse.date;
  time.textContent = formatEclipseDate(eclipse.date);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.dataset.kind = eclipse.kind;
  badge.textContent = describe(eclipse);

  header.append(time, badge);

  const facts = document.createElement('p');
  facts.className = 'eclipse-facts';
  const parts = [`Greatest eclipse ${eclipse.time} UTC`];
  if (eclipse.duration) parts.push(eclipse.duration);
  if (typeof eclipse.magnitude === 'number') parts.push(`magnitude ${eclipse.magnitude.toFixed(3)}`);
  facts.textContent = parts.join(' · ');

  const where = document.createElement('p');
  where.className = 'eclipse-where';
  where.textContent = `Visible from: ${eclipse.regions}`;

  li.append(header, facts, where);

  if (eclipse.notes) {
    const notes = document.createElement('p');
    notes.className = 'eclipse-notes';
    notes.textContent = eclipse.notes;
    li.append(notes);
  }

  const days = daysUntil(eclipse, now);
  if (days >= 0) {
    const countdown = document.createElement('p');
    countdown.className = 'eclipse-countdown';
    countdown.textContent = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
    li.append(countdown);
  }

  return li;
}

function selectedKind() {
  for (const input of els.filters) if (input.checked) return input.value;
  return 'all';
}

function render(catalogue) {
  const kind = selectedKind();
  const now = new Date();
  const matching = catalogue.filter((e) => kind === 'all' || e.kind === kind);
  const { upcoming, past } = splitEclipses(matching, now);

  els.upcoming.replaceChildren(...upcoming.map((e) => createItem(e, now)));
  els.past.replaceChildren(...past.map((e) => createItem(e, now)));

  if (!upcoming.length) {
    const li = document.createElement('li');
    li.className = 'eclipse empty';
    li.textContent = 'No upcoming eclipses in this catalogue.';
    els.upcoming.append(li);
    els.nextUp.textContent = '';
  } else {
    const next = upcoming[0];
    const days = daysUntil(next, now);
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    els.nextUp.textContent = `Next: ${describe(next)} on ${formatEclipseDate(next.date)} — ${when}.`;
  }

  if (!past.length) {
    const li = document.createElement('li');
    li.className = 'eclipse empty';
    li.textContent = 'No past eclipses in this catalogue.';
    els.past.append(li);
  }

  els.status.textContent =
    `${past.length} past and ${upcoming.length} upcoming ${kind === 'all' ? '' : `${kind} `}eclipses.`;
  delete els.status.dataset.state;
}

async function init() {
  try {
    const response = await fetch('./data/eclipses.json');
    if (!response.ok) throw new Error(`Could not load the eclipse catalogue (${response.status}).`);
    const { eclipses } = await response.json();
    render(eclipses);
    for (const input of els.filters) input.addEventListener('change', () => render(eclipses));
  } catch (error) {
    els.status.textContent = error.message || String(error);
    els.status.dataset.state = 'error';
  }
}

if (els.status) init();
