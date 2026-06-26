import type { CollectionEntry } from 'astro:content';

// Stable, unique URL slug for a diary entry — the file's name without its
// extension. Two entries can share a date, but never a filename.
export function diarySlug(entry: CollectionEntry<'diary'>): string {
  const id = entry.id.replace(/\.(md|markdown|mdx)$/i, '');
  return id.split('/').pop() as string;
}
