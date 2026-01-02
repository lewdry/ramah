# Ramah — Good news 🚩

A minimal, client-side *good news* aggregator that surfaces positive stories in reverse-chronological order.

```
██████╗  █████╗ ███╗   ███╗ █████╗ ██╗  ██╗
██╔══██╗██╔══██╗████╗ ████║██╔══██╗██║  ██║
██████╔╝███████║██╔████╔██║███████║███████║
██╔══██╗██╔══██║██║╚██╔╝██║██╔══██║██╔══██║
██║  ██║██║  ██║██║ ╚═╝ ██║██║  ██║██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
```

## Key features ✅

- Pure static frontend: Vanilla JavaScript + Tailwind CSS (via CDN).
- Fetches a public JSON feed and shows stories in reverse-chronological order.
- Infinite scroll (loads 25 stories per batch).
- Positivity indicator (△ / △△ / △△△) derived from sentiment `mean_score`.
- Theme toggle (light/dark) with preference persisted to `localStorage`.
- **Stats page**: View article count, source breakdown, and oldest article date.
- **Embed capability**: Generate customizable embed code to iframe Ramah on other sites.
- Accessible: keyboard operable story cards (Enter / Space to open), ARIA attributes, and focus styles.
- Graceful error state with a retry button when the data fetch fails.

## Data source 🔗

Ramah consumes a JSON feed hosted at:

https://lewdry.github.io/ramah-data/good_news.json

The app expects an array of story objects with the following fields (as used by `scripts/app.js`):

- `headline` (String)
- `first_sentence` (String)
- `link` (String) — the URL opened when a card is activated
- `source` (String)
- `timestamp` (ISO 8601 string)
- `mean_score` (Number 0.0–1.0)

If the feed fails to load or returns invalid data, the app shows a friendly error view and a **Retry** button.

## How it works (implementation notes) 🔧

- On load the app fetches the entire JSON feed, sorts by `timestamp` descending, and renders the first 25 stories.
- Scrolling near the bottom appends the next 25 stories until the feed is exhausted, then displays “You’re all caught up!”
- Positivity mapping (in `scripts/app.js`):
  - score ≥ 0.7 → △△△
  - score ≥ 0.4 → △△
  - score ≥ 0.2 → △
  - otherwise → no indicator
- Theme preference key: `ramah-theme`.
### Stats Page

Click the **Stats** link in the header to view:
- Total article count
- Article count by source (sorted by frequency)
- Oldest article date in the feed

Stats are calculated lazily on first visit for performance.

### Embed

Click the **Embed** link in the header to open the embed modal where you can:
- Customize width (default: `100%`, supports `%` or `px` units)
- Customize height (default: `600px`, supports `px` or `%` units)
- Select theme (auto, light, or dark)
- Preview the embed live
- Copy the generated `<iframe>` code

**Example embed code:**
```html
<iframe src="https://lewdry.github.io/ramah" width="100%" height="600px" style="border:none;" title="Ramah - Good news" loading="lazy"></iframe>
```

**With forced dark theme:**
```html
<iframe src="https://lewdry.github.io/ramah?theme=dark" width="100%" height="600px" style="border:none;" title="Ramah - Good news" loading="lazy"></iframe>
```

URL parameters:
- `?theme=light` — Force light theme
- `?theme=dark` — Force dark theme
- (Omit for auto, which respects the system/user preference)
## Run locally ⚡

This is a static site — you can open `index.html` directly, but to avoid CORS issues when fetching the JSON it's best to run a simple local server:

- Python 3: `python3 -m http.server 8000` → open http://localhost:8000
- Node (serve): `npx serve .` → follow the printed URL

No build step required; just edit `scripts/app.js`, `styles/main.css`, or `index.html` and refresh the browser.

## Important files 📁

- `index.html` — app shell & markup
- `scripts/app.js` — core client logic (fetching, rendering, infinite scroll, theme)
- `styles/main.css` — small custom CSS on top of Tailwind
- `public/` — favicon, manifest

## Contributing ✨

Contributions are welcome. Open an issue or a PR against the `lewdry/ramah` repository with proposed changes.

---

Built with ❤️ — enjoy the good news!

