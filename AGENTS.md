# AGENTS.md

Guide for agents working on this site. Read this before redesigning the frontend or adding features.
(`CLAUDE.md` is a symlink to this file — edit only this one.)

## What this project is

A personal site at **https://hihihi198.github.io** — a **static blog** plus a **dynamic diary** and a **dynamic work-log calendar**.

| | Blog (articles) | Diary | Calendar (work log) |
| --- | --- | --- | --- |
| Content lives in | Markdown files in git (`src/content/articles/`) | Cloudflare KV (**not** git) | Cloudflare KV (**not** git), `work:` key prefix |
| Rendered | At build time (SSG) | Client-side fetch from the Worker | Client-side fetch from the Worker |
| Publish by | Commit + push (Pages rebuilds) | Typing in the UI — instant, no rebuild | Typing in the UI — instant, no rebuild |
| Routes | `/`, `/articles/[slug]`, `/tags/`, `/tags/[tag]` | `/diary/` | `/calendar/` |

This split is deliberate: the blog is slow-changing, long-form, git-versioned; the diary and calendar are fast and instant. They share **only the styling system**.

**Repo:** `hihihi198/hihihi198.github.io` (public, GitHub user page). Deploys from `main` via `.github/workflows/deploy.yml` (Actions → Pages). Served at the domain root, so `astro.config.mjs` needs no `base`.

Unrelated, do not touch: a separate repo serves `https://hihihi198.github.io/navigation-site/`.

## Stack

- **Astro 7**, static output, TypeScript. **No CSS framework, no UI framework** (no Tailwind/React) — keep it that way unless the user asks.
- Markdown uses the **unified (remark/rehype) pipeline** via `@astrojs/markdown-remark` — **not** Astro 7's default Sätteri — because math needs `remark-math` + `rehype-katex` (see `astro.config.mjs` → `markdown.processor`). remark-gfm is loaded manually with **`singleTilde: false`** (the default pipeline enables it bare, and single-tilde `~...~` was eating tildes in titles like `~After Story~` — only `~~...~~` may strike through). Shiki highlighting runs on the same pipeline with dual themes (`rose-pine` / `rose-pine-dawn`) that emit `--shiki-dark` CSS vars; `components.css` maps them per theme and overrides the block background with `--color-panel`.
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
`.diary-head .lede .edit-toggle .unlock-row .pw-input .unlock-msg .composer .composer-title .field .composer-actions .composer-msg` ·
`.cal-head .cal-heatmap .cal-months .cal-month .cal-month--pad .cal-grid .cal-weekdays .cal-weekday .cal-week .cal-day .cal-day--l1 .cal-day--l2 .cal-day--l3 .cal-day--l4 .cal-day--l5 .cal-day--empty .cal-today .cal-day--selected .cal-legend .cal-diligence .cal-detail .cal-detail-hours .cal-detail-total .cal-detail-empty .cal-items .cal-item .cal-item-text .cal-item-hours .cal-item-remove`

Keep these stable; renaming means editing markup too.

### Dark mode

**Dark is the home theme.** `Layout.astro` sets `data-theme="light|dark"` on `<html>` **before paint** (inline script, avoids a flash): `localStorage.theme` wins, otherwise **dark** — the OS preference is deliberately not consulted. A header button toggles it. Dark values live in `:root[data-theme='dark']` in `tokens.css` — **add new colors there too**, or dark mode breaks.

### Language & fonts

Content is tagged **`en | ja`** — article frontmatter `lang:`, diary entry `lang`. There are only two: **Default** (English *and* Chinese) and **Japanese**. There is deliberately no `zh`; a retired one was removed. Adding a language means touching all four producers: `src/content.config.ts`, the diary composer `<select>`, the worker's `LANGS`, and the admin page `<select>` inlined in the worker.

Exactly two font stacks in `tokens.css`, and the rules below are **load-bearing — Chinese renders as Japanese if you break them**:

- **Default `--font-body` names latin faces only** and ends in **`sans-serif`**. Latin is fully covered by Newsreader/Georgia/Times, so CJK glyphs are the only ones that ever reach the trailing generic — which makes it the choice of *which system cascade Han falls into*. iOS's serif cascade holds exactly one CJK face, Hiragino Mincho (Japanese), so `serif` there renders Chinese with Japanese kanji forms. Chinese is sans by design; English is unaffected.
- **Never name a CJK family in the default stack.** An explicit family beats the OS's language-aware cascade. The original bug was `'Hiragino Mincho ProN'` sitting behind macOS-only `'Songti SC'`: fine on a Mac, Japanese-looking Chinese on an iPhone.
- **`:lang(ja)` is the sole exception** — it leads with the self-hosted `Noto Serif CJK JP`, pinning Japanese on every device.
- **`base.css` re-declares `font-family` under `:lang(ja)`.** Redefining `--font-body` on a descendant does nothing on its own: descendants inherit the font list `body` already computed. Without that re-declaration the `:lang(ja)` block is dead code. This has bitten before (commit `563381f`).

Rendering can't be checked from the terminal, and macOS masks the iOS failure — **ask the user to verify font changes on both a Mac and an iPhone**.

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
lang: en                # optional, en | ja — defaults to en; see "Language & fonts"
---
Body in Markdown.
```

Slug = filename. Queries filter drafts with `getCollection('articles', ({ data }) => !data.draft)`.
Math works in bodies: `$e^{i\pi}$` inline, `$$...$$` display (rendered by KaTeX at build time).
Images: co-locate the file next to the `.md` and reference it relatively (`![alt](./pic.png)`) — the build emits an optimized hashed WebP under `dist/_astro/`. Absolute local paths (Typora-style `/Users/...`) 404 on the site.

### Diary (dynamic, KV)

`src/content/diary/*.md` are **stale backups only** — the live diary reads from the Worker. The `diary` collection in `content.config.ts` is inert; don't wire it into pages.

## The diary Worker (`worker/`)

Live at `https://diary.hihihi198.workers.dev`. Source: `worker/src/index.ts` (single `fetch` handler, KV binding `DIARY`, Markdown rendered server-side with `marked`).

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /` | — | Standalone admin page (HTML inlined in the worker) |
| `GET /api/auth` | session cookie **or** admin password | Verify a session; **sets `Set-Cookie: session=…` on password-header success** |
| `GET /api/entries` | — | List entries, newest first (public; the feed) |
| `POST /api/entries` | admin password **or** post token | Create |
| `GET /api/entries/:id` | — | One entry, **including raw `body`** (for editing) |
| `PUT /api/entries/:id` | session cookie **or** admin password | Update |
| `DELETE /api/entries/:id` | session cookie **or** admin password | Delete |
| `GET /api/worklog` | — | List work-log days, oldest first (public) |
| `GET /api/worklog/:date` | — | One day (`work:YYYY-MM-DD`), incl. items + `totalHours` |
| `PUT /api/worklog/:date` | session cookie **or** admin password | Create-or-replace a day's items |
| `DELETE /api/worklog/:date` | session cookie **or** admin password | Delete a day |

- Auth: **session token** (`x-session-token` header; random 256-bit, pages keep it in `localStorage` under `diarySession`) **or** a stateless session cookie (`session`, `HttpOnly; Secure; SameSite=None; Path=/; Max-Age=2592000`) **or** the `x-admin-password` header. The token is the reliable path — the cookie is third-party (`workers.dev` from `github.io`) and is blocked by Safari ITP / Chrome's third-party-cookie phase-out, so it's kept only as a bonus for browsers that accept it. On password unlock `/api/auth` returns `{ ok, token }` (and sets the cookie); the token's SHA-256 lives in KV under `session:<hash>` with KV expiration as the 30-day TTL, so deleting that key revokes a device. Rotating `ADMIN_PASSWORD` invalidates cookies but not tokens. `x-post-token` remains **POST-only** for external agents (see `docs/openclaw.md`).
- Secrets (Cloudflare, never in git): `ADMIN_PASSWORD`, `POST_TOKEN`.
- **CORS is locked to `https://hihihi198.github.io`** with `Access-Control-Allow-Credentials: true` (session cookies ride cross-site fetches) and allows `GET/POST/PUT/DELETE/OPTIONS` plus those headers. **Adding a route or header means updating the CORS block**, or the browser calls fail.
- Entry shape in KV (`entry:<id>`): `{ id, date, body, bodyHtml, tags, lang, createdAt, updatedAt }`. `lang` is `en | ja` and drives the `:lang()` font stack on the rendered entry (see "Language & fonts"); `publicView`/`fullView` normalize legacy values on read, so the API never emits the retired `zh` or a missing `lang`. `id` is `YYYY-MM-DD`, with `-2`, `-3`… appended for same-day collisions.
- Work-log day shape in KV (`work:YYYY-MM-DD`): `{ date, items: [{ id, text, hours }], createdAt, updatedAt }` (epoch ms). One document per calendar day; the date string is client-supplied and never timezone-shifted. `PUT` replaces the whole item array; `totalHours` is computed on read.

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
- **Edit mode:** the page always loads **read-only** with an "Edit" button. Clicking it silently re-probes the session first — a valid token/cookie enters edit mode instantly (no password); only an expired/revoked session shows the password prompt, and password success issues a fresh token (30 days). The unlock row is never shown while a session is valid.
- **Deep links:** `/diary/#<id>` scrolls to and flashes an entry. The scroll is deferred a frame because entries render *after* load (native hash-scroll fires too early). Each entry has a `#` button that jumps + copies the permalink — entry bodies are **not** click-to-jump links (the user asked for explicit buttons).

If you rewrite this page, preserve those behaviors and keep the API/auth logic intact.

## The calendar page (`src/pages/calendar/index.astro`)

Static shell + a `<script>`, same client-side architecture as the diary page:

- Fetches `GET /api/worklog`, renders a GitHub-contributions-style grid (week columns, Sunday-first; month labels on top, weekday labels on the left). Cell intensity = `totalHours` for that day, banded `(0,1] (1,2] (2,4] (4,8] >8` into `.cal-day--l1…--l5`; tints are `color-mix` on `--color-accent` (both themes adapt automatically).
- Range: earliest logged day (at least ~6 months back) → today; the grid scrolls horizontally and starts scrolled to today. **"Today" is the UTC+8 calendar day** (`Date.now() + 8h`), unlike the diary worker's UTC-day default — the work log is the author's own, keyed to their timezone.
- Cells are **read-only history**: clicking a logged day (hash deep link `/calendar/#YYYY-MM-DD`) selects it and shows a detail panel (items + total); empty cells are always inert. **Only today is editable** — entering edit mode opens the composer for today immediately (no cell-selection step); Save PUTs the day, "Clear today" deletes it. A legend under the grid (`.cal-legend`) shows the intensity scale ("Less → More"); like GitHub, intensity reads as brighter on the dark theme and darker on the light one, since both derive from `--color-accent`.
- **Hours are capped at 16 per item and 16 per day total** (worker `parseWorkDayInput` enforces both; the client mirrors it).
- **Diligence index** (`.cal-diligence`, shown under the legend): over the 30 days before today — today excluded — each day scores `(hours − 2)²` (≤2h scores 0), weighted linearly by recency `w(age) = (31 − age)/30` (yesterday 1×, 30 days ago 1/30). Recomputed client-side on load, displayed rounded to an integer; the formula is documented in the element's `title` tooltip.
- Auth/edit-mode flow is identical to the diary page (session token, unlock-row fallback).

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
- Dates are **calendar days, not instants** — formatted with `timeZone: 'UTC'` so they never shift. The project default timezone is **UTC+8**: set article `date` to the UTC+8 calendar day. The diary Worker still defaults entry dates to the UTC day (change there means a worker edit + redeploy); the calendar page computes "today" in UTC+8 but always sends explicit dates.
- Site→Worker fetches must use `credentials: 'include'` (session cookie) and only work from the deployed origin — `localhost` dev can't reach the API (CORS origin is fixed), so diary/calendar editing is untestable via `astro dev`; verify against the deployed worker. Persistence across visits rides on the `x-session-token` header (localStorage — first-party, survives cookie blocking); if both token and cookie are absent/blocked, the unlock row is the fallback — don't remove it.
- Fonts are self-hosted in `public/fonts/` (Newsreader variable serif, IBM Plex Mono, Noto Serif CJK JP — all OFL) and declared in `fonts.css`; `Layout.astro` preloads the text serif only. Keep the Georgia/Menlo fallback stacks in `tokens.css` intact, and read "Language & fonts" before touching `--font-body`.
- `base.css` has `[hidden] { display: none !important }` — the diary toggles sections with the `hidden` attribute, and author `display` rules would otherwise beat the UA rule and show them on load.
- **Keep `katex` pinned to `^0.16`.** rehype-katex renders with 0.16's class names (`sizing reset-sizeN`), but KaTeX 0.18 renamed them (`katex-sizing`/`fontsize-ensurer`). If the imported CSS is newer than the renderer, superscripts/subscripts render full-size. Only upgrade together with rehype-katex.
- Not built yet, on the roadmap: a `/toolkit` section (interactive tools). One repo, route-based sections — the user chose this over splitting repos.

## Astro docs

https://docs.astro.build — in particular
[routing](https://docs.astro.build/en/guides/routing/),
[components](https://docs.astro.build/en/basics/astro-components/),
[content collections](https://docs.astro.build/en/guides/content-collections/),
and [styling](https://docs.astro.build/en/guides/styling/).
