---
title: A quick markdown tour
summary: Sanity-checking how headings, lists, quotes, and code render on the blog.
date: 2026-07-01
tags: [note, writing]
draft: false
---

A reminder of what's available in article bodies.

## A heading

Some body text with a [link](https://docs.astro.build) and `inline code`.

- bullet one
- bullet two
- bullet three

> A blockquote for emphasis.

```ts
function greet(name: string) {
  return `Hello, ${name}!`;
}
```

That's a code block with syntax highlighting (Astro ships Shiki by default).

## Math

Inline math like $e^{i\pi} + 1 = 0$ should render inside a sentence, and a display
block should sit centered on its own line:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$
