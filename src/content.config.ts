import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Diary entries (kept for backup; the live diary reads from the Cloudflare
// Worker KV, not from these files).
const diary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/diary' }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

// Articles — the static blog. Markdown in git, rendered at build time.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['en', 'ja', 'zh']).default('en'),
  }),
});

export const collections = { diary, articles };
