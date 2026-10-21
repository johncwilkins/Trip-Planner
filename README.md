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

Currents adjust passage timing based on the changing position and time. New Jersey offshore legs have no modeled current correction. The inside tide page combines cleaned 2022 and 2025 recorded tracks from Cape May to Manasquan Inlet, with Lavallette and Bay Head passage stops and recorded slow-section timing; cruise speed changes open stretches. Most movable bridge waits are manual assumptions; Albany and Dorset also offer arrival-based published schedule waits. Tide recommendations focus on six checkpoints: Main Marsh Thorofare, Ludlam Bay, Nummy Island, Wildwood Crest Sunset Lake, Ocean City, Beesleys Point near red 280 and Great Thoroughfare, Atlantic City near G207 at the Bader Field runway end. The last two use explicitly labeled nearby NOAA prediction proxies (8534975 and 8534638). Adjustable on-page low-water alerts default to 1.0 ft MLLW; they do not calculate clearance. Heights between NOAA high/low events are estimates.

Draft is saved for future depth checks; height and margin now control estimated bridge checks and waits. This is a planning estimate, not a verified navigable route or depth-clearance calculation.

## Third-party assets

Leaflet 1.9.4 and Leaflet Rotate 0.2.8 are vendored. The Leaflet Rotate GPL-3.0 license and unminified source are included in `dist`. NOAA shoreline and prediction data provide the chart previews and planning foundation. The BitterRadish artwork is reused from the owner’s portfolio.

## Height-aware bridge checks (NJ tide page)

The NJ track has 23 reviewed bridge crossings (the two Route 72 spans are grouped), 14 movable. `dist/nj/bridges.json` retains chart geometry locations, published MHW clearances, same-station MHW−MLLW datum differences, tide sources and provenance. Entered air height plus an adjustable 2-ft default margin determines conditional movable-bridge waits; fixed-bridge conflicts exclude departure candidates. Blank height conservatively applies all movable waits and makes no clearance decision. These are nearby-station estimates, not verified actual clearance or current bridge availability. `dist/nj/bridge-sources.json` explains exclusions and the review date.

Manual Albany–Dorset coordination remains an optional single-wait assumption, inactive when either bridge uses its arrival-based schedule. Dorset timing is projected to the sparse recorded passage after owner confirmation of the crossing. Sliders display applied waits while retaining opening assumptions separately.

## Albany / Dorset opening schedules and Coast Guard notices

The NJ planner supports independent arrival-based schedule waits or manual sliders for Albany Avenue and Dorset Avenue. Published rules in 33 CFR 117.733(h)–(i) were checked 2026-10-21; overnight/winter notice periods, summer closure and event-review flags are included. Manual pair coordination is inactive while either crossing uses a schedule.

`python scripts/refresh-uscg-notices.py` retrieves all supported NAVCEN geographic notice files from their published index, validates each file, filters the NJ region and atomically replaces `dist/nj/uscg-notices.json`. The Monday workflow refreshes this snapshot with existing marine-data updates. Manual dispatch defaults to **Notices only**; switch it off for NOAA + notices. Individual source failures are explicitly flagged as partial coverage and preserve prior records from those files; total failure preserves the prior snapshot. The public page provides a workflow link for the signed-in repository owner and a separate published-cache reload button; no access token is embedded.

`node scripts/check-nj-checkpoints.cjs` includes bridge schedule and geographic-notice checks. The map optionally shows clickable point notices and supplied lines/polygons. Date/corridor matches are advisory and do not override bridge delays.

## GoatCounter hook

All five public pages load `dist/analytics-config.js` and `dist/analytics.js`. Set `goatcounterCode` to this planner’s GoatCounter site code to enable pageviews plus tide departure/notice-refresh click events. It is configured for `https://tripplanner.goatcounter.com/count`. No keys are required. Pageview paths omit query strings; boat settings and trip inputs are not added to analytics events.

## Manasquan extension and canal timing

The inside route extends to Manasquan Inlet via Route 37 and Point Pleasant Canal. Lavallette and Bay Head are on-route passage stops; the Dillon’s Creek branch is omitted. The short join is constructed and checked against NOAA ENC land polygons, without a depth validation. Six priority tide locations remain unchanged. Seven northern bridge spans are included (Mathis, Tunney, Mantoloking, Route 13, Route 88, Brielle and NJ Transit); manual delays remain available. Lift spans also check fully raised clearance.

The checked-by-default canal-current checkbox uses NOAA ACT3996 predictions from the rolling weekly current cache. The 6.1 kn adjustable through-water default is calibrated from the July 18, 2025 GPX after removing the historical predicted current. The simulation advances through the canal using current at its evolving time, accounting for preceding bridge waits and passage direction. Unchecking preserves recorded GPX timing. One station proxies the canal; wind and spatial current differences are not modeled. `node scripts/check-nj-canal.cjs` verifies both directions, +/-2 kn, slack, earlier waits, coverage failure, forward progress and lift limits.

## Aid discrepancy classification

`dist/uscg-aids.js` interprets the retained official aid fields, keeps Unreported correction status uncertain, groups multiple reports per aid without discarding provenance, and supplies physical/visibility/other categories. Both active and corrected federal/private GeoJSON files are retained. Unknown discrepancy codes remain verbatim and unclassified rather than guessed. The page filters aid categories separately from the age filter for other notices. `dist/nj/aid-audit.json` records before/after counts, corridor exclusions, duplicate groups and source records, and refreshes with the snapshot. The 2026-10-21 full-route 0.5 nm audit found 31 federal aids (22 physical, 9 visibility), plus 2 private aids; 34 source reports group into 33 aids, all with uncertain correction status. No federal records were dropped to achieve that count.

The route also includes Point Pleasant Canal · north entrance, on the existing track north of the canal and before Route 35.
