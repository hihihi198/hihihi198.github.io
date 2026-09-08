---
title: "Attention and the Transformer"
date: 2026-09-08
summary: Scaled dot-product attention, causal masking, multi-head attention, and a tiny Transformer language model.
tags: [machine-learning, math, python]
draft: false
---

## Attention Mechanism

$$
\text{Attention}(Q, K, V)=\operatorname{softmax}(\frac{QK^T}{\sqrt{d_k}})V
$$

众所周知，softmax 抽象的是每个位置对于其他位置的注意力，再把 $V$ 以这个注意力为系数进行混合。而 $Q$ 和 $K$ 就是我们要匹配的对象。如果 $Q_i$ 接近 $K_j$，说明位置 $i$ 对位置 $j$ 应当具有很强的注意力，点乘出来的结果也越大。

> Attention builds an output vector by mixing available **value vectors**. For each **query**, compare it with every **key** to decide the mixing weights. Each key has a corresponding value at the same position. Queries and keys need matching feature sizes for dot products; values may have a different size.

Forward rule 可以写成
$$
S = \frac{QK^T}{\sqrt{d_k}}, \qquad
A = \operatorname{softmax}_{\text{keys}}(S), \qquad
O = AV
$$

这里 $S$ 是一个 `n_queries` by `n_keys` 的矩阵，描述每个 query 对每个位置的注意力 logits。那么我们当然应该在行向量上做 softmax，得出每个 query 对每个位置的注意力。

$d_k$ 是一个 query 向量的维数，也是一个 key 向量的维数（即 $Q$ 和 $K$ 的行向量维数）。写代码的时候 batch 又是一个维度，所以用的是三维张量，如 $Q$ 实际在代码中是 `q: (batch, n_queries, d_k)` 。事实上使用多头注意力的时候是四维张量，因为头的数量还占一个维度。那我们怎么做矩阵运算呢？只操作后面两个维度就行了。`A @ B` 实际上乘的是最后两个维度（这大约也是一种 broadcast）。

```python
def scaled_dot_product_attention(q: Tensor, k: Tensor, v: Tensor) -> tuple[Tensor]:
    """Return (output, weights) using differentiable PyTorch operations.

    Inputs: floating-point tensors on the same device, with the same dtype.
        q: (batch, n_queries, d_k) -- one query vector per output position.
        k: (batch, n_keys, d_k) -- one key vector per available item.
        v: (batch, n_keys, d_v) -- the corresponding value for each key.
    All dimensions are positive; n_queries and n_keys may differ.

    Returns:
        output: (batch, n_queries, d_v), weighted mixtures of value vectors.
    """
    s = q @ k.transpose(-2, -1) / math.sqrt(k.shape[-1])
    a = s.softmax(dim=-1)
    o = a @ v

    return o
```

## Trainable Weights

Currently, `q`, `k`, and `v` are independently generated random tensors. In self-attention, they come from **the same input sequence `x`**, through three learned projections:
$$
Q=XW_Q\qquad K=XW_K\qquad V=XW_V
$$

```python
class SelfAttention(nn.Module):
    def __init__(self, d_model: int, d_k: int, d_v: int) -> None:
        super().__init__()
        self.wq = nn.Linear(d_model, d_k, bias=False) # No bias needed
        self.wk = nn.Linear(d_model, d_k, bias=False)
        self.wv = nn.Linear(d_model, d_v, bias=False)

    def forward(self, x: Tensor) -> Tensor:
        return scaled_dot_product_attention(self.wq(x), self.wk(x), self.wv(x))
```

这个过程中，我们把 `d_model` 维的向量投影成了 `d_k` 和 `d_v` 维的向量。在多头注意力中我们将看到 $d_k=d_{\text{model}}/h$

## Causal Masking

在训练时，整个序列是一次性输入的。Causal masking（因果掩码）是自回归生成中用来**防止模型偷看未来 token** 的机制。做法就是把 logits 把未来位置 mask 成 `-inf`。这样算出来对未来的注意力就是 $0$。

```python
def apply_causal_mask(scores: Tensor) -> Tensor:
    T = scores.shape[-2]
    mask = torch.ones(T, T, dtype=torch.bool, device=scores.device).triu(diagonal=1)
    return scores.masked_fill(mask, float("-inf"))
```

注意这里的**未来**是指所有在当前位置之后的位置，而不是还没有输入的位置。这决定了已经输入过的 token 的 $Q,K,V$ 以及经过注意力层得到的隐藏状态不会变。计算下一个输入的最后 token 的隐藏状态时我们可以将前面的 $K, V$ 缓存下来，直接用 $\operatorname{softmax}(\dfrac{qK^T}{\sqrt{d_k}})V$。

## Multiple Heads

假设输入序列长度为 $n$ 个 token，那么 `n_queries` 和 `n_keys` 相等，记为 $n$。

把上述过程复制 $h$ 次就行了。每次得到的是输入 $X$ 输出 $O$，其中 $O$ 的维度是 $n\times d_v$。把这 $h$ 个 $O$ 拼起来，就得到了一个 $n\times (h\cdot d_v)$ 的矩阵，再乘以 $W_O\in\mathbb R^{(h\cdot d_v)\times d_{\text{model}}}$ 就行了（回到了和 $X$ 一样的 $n\times d_{\text{model}}$ 维数）。
$$
\text{MultiHead}(Q, K, V)=\operatorname{Concat}(\text{head}_1,\cdots,\text{head}_h)W^O\\\text {where head}_i=\text{Attention}(QW_i^Q,KW_i^K,VW_i^V)
$$
注意这里是论文里的符号，其中的 $Q, K, V$ 在自注意力中有 $Q=K=V=X$，当然混合 encoder 和 decoder 的时候会有交叉注意力，不过我懒得管了，毕竟现在的 LLM 基本都没有 encoder。

多头注意力让我们进行了 $h$ 次不同的 QKV 注意，学到了不同的注意机制，经验上优于单次注意。

```python
class MultiHeadSelfAttention(nn.Module):
    def __init__(self, d_model: int = 12, n_heads: int = 3) -> None:
        super().__init__()
        if d_model < 1 or n_heads < 1 or d_model % n_heads != 0:
            raise ValueError("d_model must be positive and divisible by positive n_heads.")
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        # Each projection produces all heads' features at once.
        self.wq = nn.Linear(d_model, d_model, bias=False)
        self.wk = nn.Linear(d_model, d_model, bias=False)
        self.wv = nn.Linear(d_model, d_model, bias=False)
        self.wo = nn.Linear(d_model, d_model, bias=False)

    def split_heads(self, projected: Tensor) -> Tensor:
        """(batch, tokens, d_model) -> (batch, n_heads, tokens, d_head).
        """
        batch = projected.shape[0]
        tokens = projected.shape[1]
        return projected.view(batch, tokens, self.n_heads, self.d_head).transpose(1, 2)

    def merge_heads(self, attended: Tensor) -> Tensor:
        """(batch, n_heads, tokens, d_head) -> (batch, tokens, d_model).
        """
        batch = attended.shape[0]
        tokens = attended.shape[2]
        return attended.transpose(1, 2).reshape(batch, tokens, self.d_model)

    def forward(self, x: Tensor, causal: bool = False) -> Tensor:
        """x: (batch, tokens, d_model); return the same shape.
        """
        q = self.split_heads(self.wq(x))
        k = self.split_heads(self.wk(x))
        v = self.split_heads(self.wv(x))
        attended = scaled_dot_product_attention(q, k, v, causal=causal)
        return self.wo(self.merge_heads(attended))
```

## Transformer Backbone

## Residual Connection

使用一点点数学知识就可以知道 $Y=X+f(X)$ 对 $X$ 求偏导等于 $I+\dfrac{\partial}{\partial X}f(X)$，乘以 $\dfrac{\partial L}{\partial Y}$就能得到 $\dfrac{\partial L}{\partial X}$，非常好。即使 $\dfrac{\partial f}{\partial X}$ 暂时非常小，我们也能让整体的梯度保持在 $I$ 附近，这样就解决了梯度消失的问题（大概吧）。

使用 Residual Connection，网络学习的就不再是输出，而是相对 $X$ 的增量。如果 $f$ 是 Attention，这一次 Attention 学到的实际上是相对于 $X$ 的更新。

加上 Feed Forward 我们就有了下面的代码

```python
class TransformerBlock(nn.Module):
    def __init__(self, d_model: int = 12, n_heads: int = 3, d_ff: int = 48) -> None:
        super().__init__()
        if d_ff < 1:
            raise ValueError("d_ff must be positive.")
        self.attention = MultiHeadSelfAttention(d_model, n_heads)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.ff1 = nn.Linear(d_model, d_ff)
        self.ff2 = nn.Linear(d_ff, d_model)

    def feed_forward(self, x: Tensor) -> Tensor:
        """(batch, tokens, d_model) -> (batch, tokens, d_model).

        Apply the same MLP independently to every token. Hidden features: d_ff.
        Use ff1, elementwise ReLU, then ff2. Return raw output features.
        """
        z1 = self.ff1(x)
        a1 = torch.relu(z1)
        z2 = self.ff2(a1)
        return z2

    def forward(self, x: Tensor, causal: bool = True) -> Tensor:
        z1 = self.norm1(x + self.attention(x, causal=causal))
        z2 = self.norm2(z1 + self.feed_forward(z1))
        return z2

```

## Embedding

token embedding + position embedding

众所周知，一个 token 可以被抽象为一个独热向量，独热向量与矩阵的乘积可以抽出矩阵的某一行。这个矩阵就可被称为 embedding。positions 也是同样的原理。那么我们的 embedding 是可以被训练的，就是下面的 `nn.Embedding`。

```python
class TinyLanguageModel(nn.Module):
    def __init__(
        self, vocab_size: int, context_length: int = 32,
        d_model: int = 24, n_heads: int = 4, d_ff: int = 96,
    ) -> None:
        super().__init__()
        if vocab_size < 1 or context_length < 1:
            raise ValueError("vocab_size and context_length must be positive.")
        self.context_length = context_length
        self.token_embedding = nn.Embedding(vocab_size, d_model)
        self.position_embedding = nn.Embedding(context_length, d_model)
        self.block = TransformerBlock(d_model, n_heads, d_ff)
        self.lm_head = nn.Linear(d_model, vocab_size)

    def forward(self, token_ids: Tensor) -> Tensor:
        """Input: int64 IDs (batch, tokens). Return floating logits (batch, tokens, vocab_size).

        Tokens must be in [0, vocab_size); 1 <= tokens <= context_length.
        Input and model must share a device. Do not modify input or detach outputs.
        Each output position predicts the NEXT token using only input up to that position.
        """
        if token_ids.ndim != 2 or not 1 <= token_ids.shape[1] <= self.context_length:
            raise ValueError("Expected (batch, tokens) with 1 <= tokens <= context_length.")
        positions = torch.arange(token_ids.shape[1], device=token_ids.device)
        # Token vectors: (batch, tokens, d_model); position embeddings: (tokens, d_model).
        u = self.token_embedding(token_ids) + self.position_embedding(positions) # broadcast over batches
        v = self.block(u, causal=True)
        return self.lm_head(v)

```

这个模型返回的是 logits，自此，我们完成了从输入的一串 token id 到输出 token 的预测 logits 的完整过程。

不过注意到输出维度其实是 `(batch, tokens, vocab_size)`，包括所有位置的下一个位置的 logits 的预测。在训练时这样可以一口气得到很多交叉熵数据。在推理时只取最后一位（因此也一般被优化成只对最后一个向量投影到 logits）。
