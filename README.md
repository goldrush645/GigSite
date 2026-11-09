# ENCORE — NSW live music discovery

Live website: https://goldrush645.github.io/GigSite/

ENCORE is a free-hosted prototype for discovering upcoming live music in Sydney, Wollongong and Newcastle, following artists and browsing festivals. It **links to official ticket sellers** but does not sell tickets.

## Live data sources

- **Moshtix**: public event feed imported by `scripts/sync-events.mjs`.
- **Ticketmaster**: official Discovery API v2 imported by `scripts/sync-ticketmaster.mjs`.
- Both feeds are merged into `data/events.json`, consumed by the static GitHub Pages frontend.
- The initial combined import on 9 November 2026 produced **182 concerts and 2 festivals**: 86 concerts from Moshtix/curated listings and 96 from Ticketmaster. Counts will change with scheduled refreshes.
- Event pages show the source provider and verified seller URL. When two sources confidently match by performer, venue, city and date, ENCORE keeps the first source and adds an alternative official link.
- Ticketmaster presale/general sale dates appear where the API provides them.

## Setting up Ticketmaster (no keys in public files)

1. Create a developer app at https://developer.ticketmaster.com/.
2. Find the app's **Consumer Key** (Discovery API key).
3. In the GitHub repository: **Settings → Secrets and variables → Actions → New repository secret**.
4. Set secret name **`TICKETMASTER_API_KEY`**, paste your Consumer Key in the secret value and save.
5. Go to **Actions → Refresh NSW concert listings — Moshtix and Ticketmaster → Run workflow** on `main` to refresh immediately.

**Never paste the key into `index.html`, commit it to Git, or share it in an issue.** The key is used by GitHub Actions only; the frontend reads a generated JSON file and makes no Ticketmaster API calls.

## Automatic refresh

The workflow `.github/workflows/sync-events.yml` runs each day, as well as when its importer scripts change. Its steps:

1. Pull upcoming Moshtix listings.
2. Run `node --test scripts/test-ticketmaster.mjs` (8 fixture tests).
3. Query the Ticketmaster API around Sydney, Wollongong and Newcastle if the secret is configured.
4. Merge and deduplicate events, preserving the first-detected timestamp where possible.
5. Commit the refreshed JSON to `main`; GitHub Pages republishes the data.

**Important:** Use **Run workflow** to pick up the latest code. GitHub's **Re-run jobs** on a historical run uses that run's original commit. A provider error fails the refresh rather than overwriting the published feed with an empty result. The static website continues serving the last committed data.

## What is and isn't live

**Live:** concert and festival listings, city/genre filters, searchable artist list, mobile carousels, verified event links, Ticketmaster sale dates (when available).

**Prototype only:** following artists and saving reminders in browser-local storage (no accounts, cross-device sync or emails); resale searches and monitoring (not connected); automatic tour-announcement timestamps (not reliably available).

**Data caveats:** Being newly imported into ENCORE does **not** mean a show was just announced. The first-detected timestamp is when our importer first saw the listing. Venue/performer matching and genres can be imperfect. Ticket availability, sale status and lineup may change; always verify on the official provider's event page.

Ticketmaster Discovery API: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
Moshtix API: https://developer.moshtix.com/docs/our-api/
Moshtix terms: https://developer.moshtix.com/terms/

Provider usage, attribution and commercial licensing requirements must be reviewed before broader launch. Default Ticketmaster Discovery API access is rate-limited; our current scheduled refresh keeps request volume low.
