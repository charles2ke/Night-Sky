// Picks out the world events that share a month and day with the selected date.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** "1995-02-01" -> "02-01"; returns null when the date cannot be read. */
export function monthDay(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  return match ? `${match[2]}-${match[3]}` : null;
}

/** "1995-02-01" -> "1 February". */
export function monthDayLabel(dateStr) {
  const key = monthDay(dateStr);
  if (!key) return '';
  const [m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/**
 * Events that fall on the same day of the year as `dateStr`, most recent first.
 * Events from after the selected date are dropped, so the section only ever
 * shows what had already happened by the moment being reconstructed.
 */
export function eventsOnDay(events, dateStr, limit = 6) {
  const key = monthDay(dateStr);
  if (!key || !Array.isArray(events)) return [];
  const year = Number(dateStr.slice(0, 4));
  return events
    .filter((event) => monthDay(event.date) === key && Number(event.date.slice(0, 4)) <= year)
    .sort((a, b) => Number(b.date.slice(0, 4)) - Number(a.date.slice(0, 4)))
    .slice(0, limit);
}

export function eventYear(event) {
  return Number(event.date.slice(0, 4));
}

function createItem(event) {
  const li = document.createElement('li');
  li.className = 'event';
  if (event.category) li.dataset.category = event.category;

  const head = document.createElement('div');
  head.className = 'event-head';

  const time = document.createElement('time');
  time.className = 'event-year';
  time.dateTime = event.date;
  time.textContent = String(eventYear(event));

  const title = document.createElement('h3');
  title.className = 'event-title';
  title.textContent = event.title;

  head.append(time, title);
  li.append(head);

  if (event.category) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = event.category;
    head.append(badge);
  }

  if (event.description) {
    const description = document.createElement('p');
    description.className = 'event-note';
    description.textContent = event.description;
    li.append(description);
  }

  return li;
}

/** Fill the "On this day" section for `dateStr`; hides it when nothing is known. */
export function renderOnThisDay({ section, heading, list }, events, dateStr) {
  if (!section || !list) return [];
  const matches = eventsOnDay(events, dateStr);
  const label = monthDayLabel(dateStr);
  if (heading) heading.textContent = label ? `On this day — ${label}` : 'On this day';
  list.replaceChildren(...matches.map(createItem));

  if (!matches.length) {
    const li = document.createElement('li');
    li.className = 'event empty';
    li.textContent = label
      ? `No events from this catalogue fall on ${label} before this date.`
      : 'No events to show.';
    list.append(li);
  }
  section.hidden = false;
  return matches;
}

let cache = null;

/** Load the event catalogue once; resolves to an empty list if it is unavailable. */
export async function loadEvents(url = './data/events.json') {
  if (cache) return cache;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load events (${response.status}).`);
    const data = await response.json();
    cache = Array.isArray(data.events) ? data.events : [];
  } catch {
    cache = [];
  }
  return cache;
}
