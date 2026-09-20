---
title: "Architecture: Variations of the Transformer"
date: 2026-07-22
summary: One line, on cards.
tags: [essay, transformer, machine-learning]
draft: true
---

Prerequisites: [Transformer](/articles/transformer)

## Attention

$$
\text{Attention}(Q, K, V)=\operatorname{softmax}(\frac{QK^T}{\sqrt{d_k}})V,\quad\text{where }Q=hW^Q, K=hW^K, V=hW^V
$$

主要问题：KV cache 体积、二次复杂度、数值/表达稳定性

### Grouped-Query Attention (GQA)

「分组共享」：将查询头（Query heads）分成若干组，每组共享一套 KV 头，这样可以节省 KV 缓存。见 [Qwen3-4B](/articles/qwen3-4b)

### Multi-head Latent Attention (MLA)

不减少头的数量，而是降低每个 token 的 KV 内容维度：对 KV 做低秩联合压缩，缓存压缩后的 latent vector

先把 QKV 拆成内容部分和位置部分，KV 的内容部分被联合压缩到 $c_t^{KV}=h_tW^{DKV}$（$W^{DKV}\in\mathbb R^{d\times d_c}$） 中。

[To be continued](https://chat.deepseek.com/a/chat/s/322b573e-8516-4cf3-816b-1008f1cf3d87)
