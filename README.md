# Saranyaa Ramesh — portfolio

Personal portfolio site for Saranyaa Ramesh, writer and creative strategist.

## Running it

Open `index.html` in a browser. There is no build step and no dependencies.

To publish, push to GitHub and turn on Pages under Settings → Pages, serving
from `main` at the root.

## Design

Editorial rather than card-grid: section titles split across two typefaces
(Fraunces italic over Archivo expanded italic uppercase), cream and ink spreads
alternating down the page and inverting in dark mode, a film-grain overlay, a
scrolling keyword strip, one featured case study against three secondary cards,
and the design work running full-bleed.

The palette is lavender on porcelain — deep violet `#5a3e91`, lavender
`#b9a6e3`, porcelain `#f7f6fb`, mist `#ece8f6` — and the decorative shapes in
`assets/shape-*.svg` are her motifs redrawn as vectors.

## How it is put together

A single static page. `index.html` holds all the content, `assets/styles.css`
all the presentation, `assets/app.js` all the behaviour.

Content lives in the HTML rather than in a JavaScript data structure, so search
engines, link-preview crawlers, and reader modes get the full page without
executing anything. That includes the four case studies, which are ordinary
`<article>` elements that `app.js` shows and hides based on the URL fragment
(`#/morphic`, `#/headout`, `#/yaas-media`, `#/decoding-draupadi`).

Behaviour worth knowing about:

- Theme follows `prefers-color-scheme` and remembers an explicit choice
- Accessibility panel: text size, high contrast, OpenDyslexic, text spacing,
  link highlighting, reduced motion, large cursor — persisted to `localStorage`
- Scroll reveal is scoped to `html.js`, so content stays visible if the script
  fails to load
- Marquee, parallax drift and magnetic cards all defer to
  `prefers-reduced-motion` and to the Reduce motion toggle
- High contrast mode flattens the ink spreads and disables the grain, so the
  alternating palette cannot defeat it
- The contact form posts to Web3Forms, which forwards the message to her
  inbox. It works without JavaScript too; with no access key in the form it
  falls back to composing a `mailto:` link

All 26 foreground/background pairs across both the cream and ink token sets
meet WCAG AA (4.5:1).

## Where the content came from

Migrated from a Notion page. `tools/export_notion.py` pulled the copy and the
29 attachments from Notion's public endpoints and wrote `content.json` as a
record. It has already been run and the site no longer depends on Notion; it is
kept only so the provenance is auditable.
