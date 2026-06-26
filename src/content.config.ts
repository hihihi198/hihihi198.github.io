import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One markdown file per diary entry, living under src/content/diary/.
const diary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/diary' }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { diary };
