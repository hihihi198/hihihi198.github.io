// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  // Served at the root of the user page, so no `base` is needed.
  site: 'https://hihihi198.github.io',
  markdown: {
    // Stay on the unified (remark/rehype) pipeline rather than Astro 7's
    // Sätteri, because KaTeX math support is remark-math + rehype-katex.
    // $...$ inline and $$...$$ display math → KaTeX (CSS imported by articles/[slug].astro)
    processor: unified({
      // Load remark-gfm manually with singleTilde: false — the default
      // pipeline enables it bare, and singleTilde: true turns ~After Story~
      // into a strikethrough. Only ~~...~~ should strike.
      gfm: false,
      remarkPlugins: [[remarkGfm, { singleTilde: false }], remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: {
      // Dual themes emit --shiki-light/--shiki-dark CSS vars on each block;
      // components.css picks one per [data-theme]. Backgrounds come from
      // --color-panel, not the theme.
      themes: {
        light: 'rose-pine-dawn',
        dark: 'rose-pine',
      },
    },
  },
});
