# ENCORE prototype V5

This is a static, browser-only interactive design prototype of an Australian concert discovery service. It is not a live ticketing or notification service.

## UI

- Three sections on the home screen: Just Announced, Gigs From Your Artists, Festivals.
- Horizontally swipeable carousels with buttons and progress counters, especially suited to mobile screens.
- Asymmetric poster/card layout, subtle print-texture treatment, a featured strip and poster motifs.
- Genre filtering for Just Announced. My Artists remains a separate follow-management page.
- Event details include illustrative ticket sale, Tixel and Viagogo resale options, and demo alert controls.
- A subtle hover interaction, clickable flip-side poster (desktop), and a hidden track when the ENCORE logo is tapped three times quickly.
- Favicon and prototype-specific Privacy and Terms pages.

## Demo data and privacy

Everything shown is fictional. No real concert, festival, ticket inventory or resale listing is connected; no emails are sent. Follows, location selection and demo alerts are stored in browser-local storage only. For this reason, the privacy and terms pages describe the prototype rather than pretending to be production legal documents.

## Run

Open `index.html` in a browser or publish this folder on static hosting such as GitHub Pages. No API key or build tools needed.

## Production roadmap

Confirm legal access to concert/announcement API data sources and reliable ticket links, then add backend storage, authentication, email alert delivery and source reliability tracking. Configure a custom domain when one has been chosen.