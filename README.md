# hihihi198.github.io

A personal site at **https://hihihi198.github.io** — a static **blog** plus a dynamic **diary**.

- **Blog** — Markdown articles in `src/content/articles/`, built at deploy time by **Astro 7** (static output, no UI/CSS framework). Publish by pushing to `main`; GitHub Actions rebuilds and deploys to Pages. Bodies support KaTeX math (`$inline$`, `$$display$$`).
- **Diary** — entries live in **Cloudflare KV** and are served by a **Worker** (`worker/`); the `/diary/` page fetches them client-side, so posting from the UI is instant — no rebuild. The Worker deploys separately (see `AGENTS.md`).
- **Styling** — a swappable layer: `fonts.css` → `tokens.css` → `base.css` → `components.css` under `src/styles/`, with semantic class names as the stable contract. Current theme: dark-first editorial, self-hosted Newsreader + IBM Plex Mono + Noto Serif CJK JP (`public/fonts/`).

## Posting an article

```sh
# 1. copy the template — the filename becomes the URL (/articles/<slug>/)
cp src/content/articles/template.md src/content/articles/<slug>.md

# 2. write the article: set title and date (UTC+8 day), optional summary/tags,
#    and draft: false when ready to publish. Add lang: ja for a Japanese post —
#    English and Chinese both use the default, so they need nothing.

# 3. build to catch content errors
npm run build

# 4. commit & push — Actions redeploys in about a minute
git add src/content/articles/<slug>.md
git commit -m "Add article: <title>"
git push
```

The template (`src/content/articles/template.md`) stays `draft: true`, so it never appears on the site — flip it to `false` when publishing. Bodies get syntax highlighting and KaTeX math (`$inline$`, `$$display$$`).

### Images

Put the image file next to the article in `src/content/articles/` and reference it with a relative path — the build optimizes it (hashed WebP) and ships it automatically:

```md
![alt text](./my-diagram.png)
```

Absolute paths like `/Users/...` (e.g. pasted from Typora) won't work — they only exist on your machine.

### Japanese inside a Chinese (or English) post

Frontmatter `lang:` sets the language of the whole article, but a passage can override it with a plain `lang` attribute — write the HTML inline in the Markdown:

```md
---
lang: en          # leave it here: "default" covers English *and* Chinese
---

中文段落，夹一句日文：<span lang="ja">骨折した右手の骨格を調べた。</span>继续中文。

<div lang="ja">

真面目な人に直接、具体的な話をした。

</div>

回到中文。
```

- **Keep the blank lines inside `<div>`.** With them the content is still parsed as Markdown (emphasis, links, math); without them it's dumped as literal HTML.
- **Don't set `lang: ja` on a mostly-Chinese post.** That applies the Japanese webfont to the whole article, so the Chinese renders with Japanese kanji forms — the reverse of the intent.
- Anything marked `lang="ja"` pulls in the ~250 KB Noto Serif CJK JP webfont; pages without it never load it.

This works because the `:lang(ja)` rules in `tokens.css`/`base.css` match *any* element, not just the article wrapper. Same trick works in diary entries. See "Language & fonts" in `AGENTS.md` for why the stacks are built this way — and check the result on both a Mac and an iPhone, since macOS hides the iOS failure mode.

(Diary entries don't touch git at all — they're posted from `/diary/` or the Worker API.)

## Finding an article

Articles are plain Markdown files in `src/content/articles/`, so `rg` is enough:

```sh
rg --files src/content/articles            # list all article files
rg 'keyword' src/content/articles          # search titles, frontmatter, and bodies
rg -l 'title: Hello' src/content/articles   # just the matching file path(s)
```

## Commands

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server at `localhost:4321` |
| `npm run build` | Build the production site to `./dist/` (run before committing) |

## Documentation

- `AGENTS.md` — the real docs: architecture, the styling system, content formats, the diary Worker API, and deploy workflows.
  - `docs/openclaw.md` — posting diary entries programmatically (post token).
