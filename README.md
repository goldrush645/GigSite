# ENCORE V6: real NSW concert discovery prototype

Website: https://goldrush645.github.io/GigSite/

## Current functionality
- The live feed currently includes 85 concerts and two festivals, comprising 16 curated concert listings and 69 new concerts imported from Moshtix on 9 November 2026. Totals change with daily refreshes.
- Real artists, venues, dates and official seller event links. The city selector, search, genre filtering, artist following, carousels and festival matching still work.
- `data/events.json` is the public feed. `data/seed.json` is the curated fallback.
- Following and reminder preferences are saved only in browser storage. No accounts or email alerts exist yet.

## Real-data refresh
A once-daily GitHub Actions workflow (`.github/workflows/sync-events.yml`) calls `scripts/sync-events.mjs`, using Moshtix's documented anonymous GraphQL interface. It requests a limited number of sorted pages, maps supported Sydney/Wollongong/Newcastle localities, and merges matches with the verified baseline while deduplicating by Moshtix ID. The refreshed `data/events.json` is committed to the repository.

**Status:** The live importer has been tested successfully in GitHub Actions. The API's chronological query initially returned events from 1999–2004; adding `includePastEvents: false` resolved that problem. The importer now checks that upcoming listings match our supported NSW locations. If the API returns no local matches or fails, the script exits without overwriting the existing feed. URLs are constructed with clean slugs and Moshtix event IDs.

To run an extra refresh: GitHub → Actions → **Update official NSW concert listings** → **Run workflow** → `main`. Do not use **Re-run jobs** on an old run: it checks out the original commit rather than the latest code. Repository workflow permissions must allow `contents: write` for the automatic commit.

Moshtix documentation and usage terms:
- https://developer.moshtix.com/docs/our-api/
- https://developer.moshtix.com/docs/queries/
- https://developer.moshtix.com/terms/

Moshtix discourages excessive polling. This non-commercial prototype uses a conservative daily schedule; review licensing and contact Moshtix before expanding traffic or commercialising.

## Accuracy and limitations
- “Recently listed” is **not** an assertion that the artist just announced the show. When present, `detectedAt` means ENCORE first saw it, not its official announcement date.
- Presale, ticket inventory, prices, sellouts, resale availability and notification delivery are **not currently verified or operational**.
- Automated performer extraction and genre grouping are heuristics. Imported festivals may not have full lineups; check the original provider.
- This is a static site hosted on GitHub Pages. It does not expose paid provider API keys; a future Ticketmaster integration should keep its credential in a server-side GitHub Actions secret or backend.
- Data sources do not yet cover all Australian ticket sellers or smaller venues.

Next steps: verify individual event accuracy and venue classifications, expand venue/locality coverage, and add a licensed Ticketmaster feed before building announcement alerts.
