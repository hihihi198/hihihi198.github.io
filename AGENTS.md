# AGENTS.md

Guide for agents working on this site. Read this before redesigning the frontend or adding features.
(`CLAUDE.md` is a symlink to this file — edit only this one.)

## What this project is

A personal site at **https://hihihi198.github.io** — a **static blog** plus a **dynamic diary**.

| | Blog (articles) | Diary |
| --- | --- | --- |
| Content lives in | Markdown files in git (`src/content/articles/`) | Cloudflare KV (**not** git) |
| Rendered | At build time (SSG) | Client-side fetch from the Worker |
| Publish by | Commit + push (Pages rebuilds) | Typing in the UI — instant, no rebuild |
| Routes | `/`, `/articles/[slug]`, `/tags/`, `/tags/[tag]` | `/diary/` |

This split is deliberate: the blog is slow-changing, long-form, git-versioned; the diary is fast and instant. They share **only the styling system**.

**Repo:** `hihihi198/hihihi198.github.io` (public, GitHub user page). Deploys from `main` via `.github/workflows/deploy.yml` (Actions → Pages). Served at the domain root, so `astro.config.mjs` needs no `base`.

Unrelated, do not touch: a separate repo serves `https://hihihi198.github.io/navigation-site/`.

## Stack

- **Astro 7**, static output, TypeScript. **No CSS framework, no UI framework** (no Tailwind/React) — keep it that way unless the user asks.
- Markdown uses the **unified (remark/rehype) pipeline** via `@astrojs/markdown-remark` — **not** Astro 7's default Sätteri — because math needs `remark-math` + `rehype-katex` (see `astro.config.mjs` → `markdown.processor`). Shiki highlighting runs on the same pipeline with dual themes (`rose-pine` / `rose-pine-dawn`) that emit `--shiki-dark` CSS vars; `components.css` maps them per theme and overrides the block background with `--color-panel`.
- **KaTeX math** in article bodies: `$inline$` and `$$display$$`. The KaTeX CSS is imported by `src/pages/articles/[slug].astro`, so only article pages pay for it.
- **Cloudflare Worker + KV** backend for the diary (`worker/`), deployed separately from the site.

## The styling system — read this before any redesign

**This is the project's defining constraint.** The user explicitly rejected off-the-shelf themes and asked for an architecture where a complete restyle is easy. All styling is centralized so that **presentation is a swappable layer**.

```
src/styles/
  fonts.css       # @font-face for the self-hosted fonts in public/fonts/
  tokens.css      # design tokens (+ dark variants) — the fast re-theme lever
  base.css        # reset, body, element defaults — no classes
  components.css  # EVERY component rule, keyed by semantic class name
  main.css        # @imports the four above; imported once by Layout.astro
```

Rules to preserve:

1. **`.astro` components are structure-only.** No `<style>` blocks inside components or pages. All visual rules go in `components.css`.
2. **Semantic class names are the stable contract.** Markup carries meaning (`.post-card`, `.entry`), never utility/presentational classes.
3. **Colors, fonts, radii, and widths come from tokens** (`var(--color-accent)`, `var(--radius)`, …) — never hard-code values in component rules.
4. **Diary CSS must be global** (i.e. in `components.css`). The diary injects DOM at runtime; Astro's *scoped* styles rely on a build-time attribute that JS-created elements don't have, so scoped styles silently fail to apply. This has bitten before.

### How to restyle

- **Re-theme (quick):** edit `tokens.css` only — colors/fonts/radii/width. Whole site updates.
- **Full visual overhaul:** rewrite `components.css`, keeping class names. Markup, routes, worker, and diary JS stay untouched.
- Only touch `.astro` files if the *structure* must change — and if you add a class, add its rule to `components.css`.

### Current class contract

`.site-header .brand .nav .site-main .site-footer #theme-toggle` ·
`.post-list .post-card .post-card__title .post-card__meta .post-card__summary .tag .tag-list .page-title` ·
`.post__header .post__title .post__meta .post__back .post-body` ·
`.timeline .month .month-label .entry .node .entry-head .linkbtn .entry-tools .loading .empty` ·
`.diary-head .lede .edit-toggle .unlock-row .pw-input .unlock-msg .composer .composer-title .field .composer-actions .composer-msg`

Keep these stable; renaming means editing markup too.

### Dark mode

**Dark is the home theme.** `Layout.astro` sets `data-theme="light|dark"` on `<html>` **before paint** (inline script, avoids a flash): `localStorage.theme` wins, otherwise **dark** — the OS preference is deliberately not consulted. A header button toggles it. Dark values live in `:root[data-theme='dark']` in `tokens.css` — **add new colors there too**, or dark mode breaks.

## Content

### Articles (static, git)

`src/content/articles/*.md`; collection defined in `src/content.config.ts`.

Posting flow: copy `src/content/articles/template.md` (stays `draft: true`, so it never renders) to a new slug → write → `npm run build` → commit + push.

```md
---
title: My post          # required
summary: One line.      # optional — shown on cards
date: 2026-07-05        # required
tags: [essay, note]     # optional, drives /tags/
draft: false            # optional; true hides it from list/tags/routes
---
Body in Markdown.
```

Slug = filename. Queries filter drafts with `getCollection('articles', ({ data }) => !data.draft)`.
Math works in bodies: `$e^{i\pi}$` inline, `$$...$$` display (rendered by KaTeX at build time).

### Diary (dynamic, KV)

`src/content/diary/*.md` are **stale backups only** — the live diary reads from the Worker. The `diary` collection in `content.config.ts` is inert; don't wire it into pages.

## The diary Worker (`worker/`)

Live at `https://diary.hihihi198.workers.dev`. Source: `worker/src/index.ts` (single `fetch` handler, KV binding `DIARY`, Markdown rendered server-side with `marked`).

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /` | — | Standalone admin page (HTML inlined in the worker) |
| `GET /api/auth` | admin password | Verify a password (used to unlock edit mode) |
| `GET /api/entries` | — | List entries, newest first (public; the feed) |
| `POST /api/entries` | admin password **or** post token | Create |
| `GET /api/entries/:id` | — | One entry, **including raw `body`** (for editing) |
| `PUT /api/entries/:id` | admin password | Update |
| `DELETE /api/entries/:id` | admin password | Delete |

- Auth headers: `x-admin-password`, or `x-post-token` (**POST-only**, for external agents — see `docs/openclaw.md`).
- Secrets (Cloudflare, never in git): `ADMIN_PASSWORD`, `POST_TOKEN`.
- **CORS is locked to `https://hihihi198.github.io`** and allows `GET/POST/PUT/DELETE/OPTIONS` plus those headers. **Adding a route or header means updating the CORS block**, or the browser calls fail.
- Entry shape in KV (`entry:<id>`): `{ id, date, body, bodyHtml, tags, createdAt, updatedAt }`. `id` is `YYYY-MM-DD`, with `-2`, `-3`… appended for same-day collisions.

Deploy the worker (site deploy does **not** cover it):

```sh
node worker/node_modules/typescript/bin/tsc -p worker/tsconfig.json   # typecheck
CLOUDFLARE_API_TOKEN="$(cat ~/.cloudflare-api-token)" \
  worker/node_modules/.bin/wrangler deploy --config worker/wrangler.toml
```

`wrangler login` (OAuth) is blocked by Cloudflare bot protection in this environment — **always use the API token file** above.

## The diary page (`src/pages/diary/index.astro`)

Static shell + a `<script>` that does everything client-side:

- Fetches `GET /api/entries`, groups entries by month, builds the timeline DOM (classes above), newest first.
- **Edit mode:** the page always loads **read-only**. "Edit" reveals a password prompt → `GET /api/auth` → on success shows the composer and inline Edit/Delete per entry. The password is held **in memory only** — deliberately not cached, so the composer never appears on load. Don't reintroduce persistence.
- **Deep links:** `/diary/#<id>` scrolls to and flashes an entry. The scroll is deferred a frame because entries render *after* load (native hash-scroll fires too early). Each entry has a `#` button that jumps + copies the permalink — entry bodies are **not** click-to-jump links (the user asked for explicit buttons).

If you rewrite this page, preserve those behaviors and keep the API/auth logic intact.

## Workflow

```sh
npm install
npm run dev      # local dev
npm run build    # ALWAYS run before committing — catches Astro/collection errors
```

When starting the dev server, prefer background mode: `astro dev --background`, managed with `astro dev stop` / `status` / `logs`.

- Commit + push to `main` → Actions builds and deploys Pages. Watch with `gh run watch <id> --repo hihihi198/hihihi198.github.io`.
- Verify live with `curl -s -o /dev/null -w "%{http_code}" https://hihihi198.github.io/<route>`, and grep the HTML for expected classes.
- The site can't be visually inspected from the terminal — **ask the user to confirm anything visual** in a browser.
- CI warns that some GitHub Actions target deprecated Node 20. Harmless; bump versions only if asked.

## Conventions & gotchas

- **No new dependencies** for styling or UI without asking — plain CSS is a deliberate choice.
- `.claude/` is gitignored. Never commit secrets; tokens live in `~/.cloudflare-api-token`, `~/.diary-post-token` (chmod 600).
- Old commits contain a harmless `.claude/settings.local.json`; the user **declined** scrubbing git history. Don't re-propose it.
- Astro's `is:global` blocks don't support `:global()` — use plain selectors there (lightningcss warns and drops the rule).
- Dates are **calendar days, not instants** — formatted with `timeZone: 'UTC'` so they never shift. The project default timezone is **UTC+8**: set article `date` to the UTC+8 calendar day. The diary Worker still defaults entry dates to the UTC day (change there means a worker edit + redeploy).
- Fonts are self-hosted in `public/fonts/` (Newsreader variable serif + IBM Plex Mono, both OFL) and declared in `fonts.css`; `Layout.astro` preloads the text serif. Keep the Georgia/Menlo fallback stacks in `tokens.css` intact.
- `base.css` has `[hidden] { display: none !important }` — the diary toggles sections with the `hidden` attribute, and author `display` rules would otherwise beat the UA rule and show them on load.
- **Keep `katex` pinned to `^0.16`.** rehype-katex renders with 0.16's class names (`sizing reset-sizeN`), but KaTeX 0.18 renamed them (`katex-sizing`/`fontsize-ensurer`). If the imported CSS is newer than the renderer, superscripts/subscripts render full-size. Only upgrade together with rehype-katex.
- Not built yet, on the roadmap: a `/toolkit` section (interactive tools). One repo, route-based sections — the user chose this over splitting repos.

## Astro docs

https://docs.astro.build — in particular
[routing](https://docs.astro.build/en/guides/routing/),
[components](https://docs.astro.build/en/basics/astro-components/),
[content collections](https://docs.astro.build/en/guides/content-collections/),
and [styling](https://docs.astro.build/en/guides/styling/).
