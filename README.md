# Trip Planner

BitterRadish coastal current and New Jersey inside tide passage planners.

- Home: `dist/index.html`
- Coastal currents: `dist/currents.html`
- New Jersey inside tides: `dist/nj.html`

Static HTML, JavaScript and saved NOAA prediction files; no server, API key or build dependencies required. The site includes the full saved cache. Chart tiles load separately from NOAA.

## GitHub Pages

Enable **Settings → Pages → Source: GitHub Actions**. The workflow deploys the `dist` folder on pushes to `main` and when manually run.

Custom domain: **tripplanner.bitterradish.com**. In GoDaddy DNS, create a CNAME named **tripplanner** pointing to **johncwilkins.github.io**. Do not change nameservers or other subdomain records. Set the same custom domain in GitHub Pages, then enable Enforce HTTPS once its certificate is ready.

## Weekly NOAA updates

The Pages workflow refreshes predictions every Monday at 2 a.m. America/New_York. The two UTC schedule entries account for daylight saving. The Python refresh preserves four historical weeks, 52 departure weeks and an arrival buffer, fetching only missing blocks. Both current and NJ tide caches refresh together. No secrets are needed.

To refresh manually, run `python scripts/refresh-weekly.py`, or use Actions → Deploy Trip Planner → Run workflow.

The first workflow run expands the uploaded source bundle into ordinary versioned files, then removes the bundle. Future edits are made directly to source files.

## Calculations

Currents adjust passage timing based on the changing position and time. New Jersey offshore legs have no modeled current correction. The inside tide page uses a cleaned 2022 recorded track and slow-section timing; cruise speed changes open stretches. Three adjustable bridge delays are assumptions, not opening schedules. Tide recommendations focus on Main Marsh Thorofare, Ludlam Bay, Nummy Island and Wildwood Crest Sunset Lake. Heights between NOAA high/low events are estimates.

Draft and height inputs are stored in the browser for future clearance features. This is a planning estimate, not a verified navigable route or depth-clearance calculation.

## Third-party assets

Leaflet 1.9.4 and Leaflet Rotate 0.2.8 are vendored. The Leaflet Rotate GPL-3.0 license and unminified source are included in `dist`. NOAA shoreline and prediction data provide the chart previews and planning foundation. The BitterRadish artwork is reused from the owner’s portfolio.
