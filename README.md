# hihihi198.github.io

A personal site at **https://hihihi198.github.io** — a static **blog** plus a dynamic **diary**.

- **Blog** — Markdown articles in `src/content/articles/`, built at deploy time by **Astro 7** (static output, no UI/CSS framework). Publish by pushing to `main`; GitHub Actions rebuilds and deploys to Pages. Bodies support KaTeX math (`$inline$`, `$$display$$`).
- **Diary** — entries live in **Cloudflare KV** and are served by a **Worker** (`worker/`); the `/diary/` page fetches them client-side, so posting from the UI is instant — no rebuild. The Worker deploys separately (see `AGENTS.md`).
- **Styling** — a swappable layer: `fonts.css` → `tokens.css` → `base.css` → `components.css` under `src/styles/`, with semantic class names as the stable contract. Current theme: dark-first editorial, self-hosted Newsreader + IBM Plex Mono (`public/fonts/`).

## Posting an article

```sh
npm run new     # prompts for title/summary/tags, writes src/content/articles/<slug>.md
#   ...write the body...
npm run ship    # builds, commits the article, pushes — the site redeploys in ~a minute
```

- Slug and date (UTC+8) are generated; the filename becomes the URL (`/articles/<slug>/`).
- Optional frontmatter: `summary` (shown on cards), `tags` (drives `/tags/`), `draft: true` (hides it everywhere).
- Bodies get syntax highlighting and KaTeX math (`$inline$`, `$$display$$`).
- `npm run ship` commits **only** `src/content/articles/` — other working-tree changes stay uncommitted.

### Manually, from the terminal

If you'd rather skip the scripts:

1. Create `src/content/articles/<slug>.md` yourself — the filename becomes the URL:

   ```md
   ---
   title: My post          # required
   date: 2026-07-21        # required, UTC+8 calendar day
   summary: One line.      # optional — shown on cards
   tags: [essay, note]     # optional — drives /tags/
   draft: false            # optional — true hides it from list/tags/routes
   ---

   Body in Markdown (code highlighting and KaTeX math included).
   ```

2. `npm run build` to catch content errors, then commit and push to `main` — same deploy as `npm run ship`.

(Diary entries don't touch git at all — they're posted from `/diary/` or the Worker API.)

## Commands

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server at `localhost:4321` |
| `npm run build` | Build the production site to `./dist/` (run before committing) |

## Documentation

- `AGENTS.md` — the real docs: architecture, the styling system, content formats, the diary Worker API, and deploy workflows.
- `docs/openclaw.md` — posting diary entries programmatically (post token).
