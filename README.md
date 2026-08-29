# Night Sky

A small web app that reconstructs the night sky for **any date and any place**: the stars,
constellations, the naked-eye planets and the Moon (with its correct phase), drawn as a wide
panorama in the style described by the
[historical night sky generator skill](.github/skills/historical-night-sky-generator/SKILL.md).

<!-- live-site:start -->
**Live site:** <https://charles2ke.github.io/Night-Sky/>
<!-- live-site:end -->

## Using it

1. Enter a **place** — a city name (e.g. `Al Ain, UAE`) or raw coordinates (`-24.5, -69.25`).
2. Enter a **date** and the **local time** (defaults to midnight).
3. Pick the direction you are **facing** (defaults to South) and press *Show the night sky*.

You can toggle constellation lines and object names, adjust the light-pollution level, and
download the rendered panorama as a PNG.

## Galaxies page

`galaxies.html` is an illustrated guide to the galaxies we know. It leads with our own **Milky
Way** — its structure, Sagittarius A*, and where to look for it — and then lists fifteen other
notable galaxies and deep-sky views, from Andromeda and the Magellanic Clouds to the Hubble
Ultra-Deep Field. Content lives in `data/galaxies.json` and is rendered by `src/galaxies.js`.

Every entry carries an openly licensed photograph (public-domain NASA/ESA Hubble releases and
Creative Commons imagery from ESO and others) served from Wikimedia Commons, with the author and
licence credited beneath each picture.

Two sub-sections hang off the galaxies:

- **Our planets** — a sub-section of the Milky Way (`galaxies.html#solar-system`) that draws the
  Solar System from `data/planets.json`: an SVG diagram of the eight planets to scale with each
  other and with the limb of the Sun, a second diagram of their average distances from the Sun on a
  square-root scale, and a photograph and fact sheet for every planet. Rendered by
  `src/solar-system.js`.
- **Black holes** — see below.

## Black holes page

`black-holes.html`, linked from the sub-menu under *Galaxies* on every page, is a guide to the
black holes we know: stellar-mass remnants such as Cygnus X-1 and Gaia BH1, intermediate-mass
candidates such as HLX-1, and the supermassive giants Sagittarius A*, M87* and TON 618. Each entry
gives the mass, the size of the event horizon, the distance and how it was found, alongside an
openly licensed picture.

A logarithmic bar chart compares every event horizon on the page — from a few dozen kilometres for
a collapsed star to thousands of astronomical units for the largest quasar engines — and radio
buttons filter the catalogue by class. The data lives in `data/black-holes.json` and is rendered by
`src/black-holes.js`.

## Eclipses page

`eclipses.html` (linked from the header of every page) lists solar and lunar eclipses:

- **Upcoming** — events still ahead of today, soonest first, with a countdown in days.
- **Past** — events that have already happened, most recent first.

Radio buttons filter the catalogue to solar or lunar eclipses only. Each entry shows the type,
the instant of greatest eclipse in UTC, the duration and magnitude, where it was (or will be)
visible from, and a short note. The data lives in `data/eclipses.json` and follows the NASA/GSFC
[Five Millennium Catalog of Solar and Lunar Eclipses](https://eclipse.gsfc.nasa.gov/eclipse.html);
the past/upcoming split is computed from the current date in the browser.

## What is computed vs. illustrated

Celestial positions are computed, not invented:

- Star positions come from the Yale Bright Star / HYG catalogue (magnitude ≤ 6.0), precessed from
  J2000 to the equinox of the requested date.
- The Moon's position, distance, illuminated fraction and bright-limb angle use the main periodic
  terms of ELP-2000/82 (Meeus, *Astronomical Algorithms*, ch. 47).
- Planet positions use the JPL approximate elements for Mercury through Saturn.
- Local sidereal time is derived from the date, time and the resolved longitude; the local time is
  converted to UTC with the place's IANA time zone.

The horizon, the buildings and the sky glow are **illustrative**: they respond to the place and
era (denser and brighter for large, modern cities) but do not depict a real skyline. The Moon is
drawn at three times its apparent size so that its phase is visible at panorama scale.

## Running locally

```bash
npm install
npm start          # serves the site on http://127.0.0.1:4173
```

The app is a static site — `index.html`, `styles.css`, `src/` and `data/` — with no build step.

## MCP server

Use the Night Sky astronomy engine from an MCP client with
[`npx`](https://docs.npmjs.com/cli/using-npx):

```json
{
  "servers": {
    "night-sky": {
      "command": "npx",
      "args": ["-y", "@charles2ke/night-sky-mcp"]
    }
  }
}
```

The server uses the stdio transport. To run it from a local clone instead:

```bash
npm install
npm run mcp
```

Tools:

| Tool | What it returns |
| --- | --- |
| `resolve_place` | Coordinates, time zone and population for a place name or `"lat, lon"` string |
| `moon_phase` | Phase name, illuminated fraction, age, distance and alt/az of the Moon |
| `sky_snapshot` | Moon, naked-eye planets and brightest named stars above the horizon, optionally limited to the 140° panorama for one compass direction |
| `visible_constellations` | Constellations above the horizon, with the altitude and azimuth of their centre |
| `eclipses` | Upcoming and past solar and lunar eclipses around a reference date, with dates, magnitudes and visibility regions |
| `on_this_day` | World events that share a month and day with a date and happened on or before it |
| `galaxies` | The galaxy guide: the full list, or the facts, summary and image credits for one galaxy |

The sky tools (`moon_phase`, `sky_snapshot`, `visible_constellations`) take a place (`place`, or
`latitude` and `longitude`, plus an optional IANA `timezone`) and a local `date` and `time`;
`eclipses`, `on_this_day` and `galaxies` read the bundled catalogues in `data/`. Every tool answers
with JSON.

## Tests

Playwright covers rendering, Moon phases, direction changes, coordinate input and error handling:

```bash
npx playwright install --with-deps chromium
npm test
```

Screenshots are written to `test-results/screenshots/` and are uploaded as build artifacts by the
`Tests` workflow.

## Automation

- `.github/workflows/tests.yml` runs the Playwright suite on pushes and pull requests and uploads
  the screenshots and HTML report.

The site is published by GitHub Pages straight from the repository: set
**Settings → Pages → Build and deployment → Source** to *Deploy from a branch* and pick `main` /
`/ (root)`. Everything is plain HTML, CSS and ES modules with relative paths, so no build step is
needed; the `.nojekyll` marker keeps Pages from running the files through Jekyll.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `galaxies.html`, `eclipses.html`, `black-holes.html`, `styles.css` | Page shells and styling |
| `src/astro.js` | Time, precession, alt/az, Sun, Moon and planet calculations |
| `src/render.js` | Canvas panorama renderer, overlay and compass strip |
| `src/geocode.js` | Place lookup (Open-Meteo, with an offline fallback list) |
| `src/app.js` | Form handling and wiring |
| `src/eclipses.js` | Eclipse catalogue loading, past/upcoming split and rendering |
| `src/galaxies.js`, `src/solar-system.js` | Galaxy page, and the Solar System scale diagrams |
| `src/black-holes.js` | Black hole catalogue, event-horizon chart and class filter |
| `src/commons.js` | Wikimedia Commons image URLs and the shared figure/fact builders |
| `data/` | Star catalogue, constellation lines, galaxies, planets, black holes and eclipses |
| `mcp/server.js` | Model Context Protocol server over stdio |
| `tests/` | Playwright end-to-end tests |

## Credits

Star and constellation data from [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3),
derived from the Yale Bright Star and HYG catalogues. Place lookup by
[Open-Meteo](https://open-meteo.com/).
