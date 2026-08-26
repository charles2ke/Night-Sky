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

`mcp/server.js` exposes the same astronomy engine to AI assistants over the
[Model Context Protocol](https://modelcontextprotocol.io), using the stdio transport:

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

Every tool takes a place (`place`, or `latitude` and `longitude`, plus an optional IANA
`timezone`) and a local `date` and `time`, and answers with JSON.

Register it with an MCP client, for example in `.vscode/mcp.json` or a Claude Desktop config:

```json
{
  "servers": {
    "night-sky": {
      "command": "node",
      "args": ["/absolute/path/to/Night-Sky/mcp/server.js"]
    }
  }
}
```

## Tests

Playwright covers rendering, Moon phases, direction changes, coordinate input and error handling:

```bash
npx playwright install --with-deps chromium
npm test
```

Screenshots are written to `test-results/screenshots/` and are uploaded as build artifacts by the
`Tests` workflow.

## Automation

- `.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main` and
  refreshes the live-site link in this README from the deployment URL.
- `.github/workflows/tests.yml` runs the Playwright suite on pushes and pull requests and uploads
  the screenshots and HTML report.

To enable publishing, set **Settings → Pages → Build and deployment → Source** to *GitHub Actions*.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page shell and styling |
| `src/astro.js` | Time, precession, alt/az, Sun, Moon and planet calculations |
| `src/render.js` | Canvas panorama renderer, overlay and compass strip |
| `src/geocode.js` | Place lookup (Open-Meteo, with an offline fallback list) |
| `src/app.js` | Form handling and wiring |
| `data/` | Star catalogue and constellation lines |
| `mcp/server.js` | Model Context Protocol server over stdio |
| `tests/` | Playwright end-to-end tests |

## Credits

Star and constellation data from [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3),
derived from the Yale Bright Star and HYG catalogues. Place lookup by
[Open-Meteo](https://open-meteo.com/).
