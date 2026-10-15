# Trip Planner

BitterRadish coastal current and New Jersey inside tide passage planners.

- Home: `dist/index.html`
- Coastal currents: `dist/currents.html`
- New Jersey inside tides: `dist/nj.html`
- Detailed help: `dist/help.html`
- About: `dist/about.html`

Static HTML, JavaScript and saved NOAA prediction files; no server, API key or build dependencies required. The site includes the full saved cache. Chart tiles load separately from NOAA.

## GitHub Pages

Enable **Settings → Pages → Source: GitHub Actions**. The workflow deploys the `dist` folder on pushes to `main` and when manually run.

Custom domain: **tripplanner.bitterradish.com**. In GoDaddy DNS, create a CNAME named **tripplanner** pointing to **johncwilkins.github.io**. Do not change nameservers or other subdomain records. Set the same custom domain in GitHub Pages, then enable Enforce HTTPS once its certificate is ready.

## Weekly NOAA updates

The Pages workflow refreshes predictions every Monday at 2 a.m. America/New_York. The two UTC schedule entries account for daylight saving. The Python refresh preserves four historical weeks, 52 departure weeks and an arrival buffer, fetching only missing blocks. Both current and NJ tide caches refresh together. No secrets are needed.

To refresh manually, run `python scripts/refresh-weekly.py`, or use Actions → Deploy Trip Planner → Run workflow.

The first workflow run expands the uploaded source bundle into ordinary versioned files, then removes the bundle. Future edits are made directly to source files.

## Calculations

Currents adjust passage timing based on the changing position and time. New Jersey offshore legs have no modeled current correction. The inside tide page uses a cleaned 2022 recorded track and slow-section timing; cruise speed changes open stretches. Movable bridge delays are assumptions, not opening schedules. Tide recommendations focus on six checkpoints: Main Marsh Thorofare, Ludlam Bay, Nummy Island, Wildwood Crest Sunset Lake, All Seasons Marina and the Atlantic City rail bridge. The last two use explicitly labeled nearby NOAA prediction proxies (8534975 and 8534638). Adjustable on-page low-water alerts default to 1.0 ft MLLW; they do not calculate clearance. Heights between NOAA high/low events are estimates.

Draft is saved for future depth checks; height and margin now control estimated bridge checks and waits. This is a planning estimate, not a verified navigable route or depth-clearance calculation.

## Third-party assets

Leaflet 1.9.4 and Leaflet Rotate 0.2.8 are vendored. The Leaflet Rotate GPL-3.0 license and unminified source are included in `dist`. NOAA shoreline and prediction data provide the chart previews and planning foundation. The BitterRadish artwork is reused from the owner’s portfolio.

## Height-aware bridge checks (NJ tide page)

The NJ track has 16 reviewed bridge crossings (the two Route 72 spans are grouped), eight movable. `dist/nj/bridges.json` retains chart geometry locations, published MHW clearances, same-station MHW−MLLW datum differences, tide sources and provenance. Entered air height plus an adjustable 2-ft default margin determines conditional movable-bridge waits; fixed-bridge conflicts exclude departure candidates. Blank height conservatively applies all movable waits and makes no clearance decision. These are nearby-station estimates, not verified clearance or opening schedules. `dist/nj/bridge-sources.json` explains exclusions and the review date.

Albany–Dorset coordination is an explicit optional single-wait assumption, enabled by the UI, not a timetable prediction. Dorset timing is projected to the sparse recorded passage after owner confirmation of the crossing. Sliders display applied waits while retaining opening assumptions separately.
