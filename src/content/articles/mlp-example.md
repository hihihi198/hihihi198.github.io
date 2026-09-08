---
title: "MLP Example"
date: 2026-09-08
summary: A two-layer MLP from scratch — forward pass, backpropagation, initialization, and the PyTorch version.
tags: [machine-learning, math, python]
draft: false
---

To save myself some troubles, I'll ignore the batch count. (Set $B=1$)

1 item in a batch is called a **sample**. So here we consider only one sample.

## Forward

Code uses the row convention instead of the column convention we learned in linear algebra. So a vector of 64 dimensions is a 1 by 64 matrix instead of a 64 by 1 matrix, which actually makes more sense to me since I'm more comfortable with the computer.

- Layer 1
  - Input: a vector of 64 dimensions (I will call it "a 1 by 64").
  - Math: $f(xW+b)$, where $xW+b$ is pre-activation and $f$ is the activation function. Here $f$ is ReLU. It is applied **elementwise**.
  - Output: a 1 by 32.
  - Note: $W$ is a 64 by 32. The result of $xW$ is a 1 by 32.
  - A **neuron** is an element of $xW+b$, being $x\cdot w_i+b$, where $w_i$ is a column vector of $W$.
  - **ReLU is elementwise**. $\text{ReLU}(Z)_{ij}=\max(0, Z_{ij})$, which is called the neuron's **activation**.
- Layer 2
  - Input: a 1 by 32.
  - Math: $xW+b$.
  - Output: a 1 by 10. **They are called logits.**
  - A useful way to think about a logit is as an unnormalized class score. A larger logit means the network currently favors that class more strongly.
- Softmax
  - Effect: turn a 1 by 10 into a probability distribution of 10.
  - Input: a 1 by 10.
  - Math: $P_j=\dfrac{\exp Z_j}{\sum_k\exp Z_k}$
  - Output: a 1 by 10.

Very good! This is the full forward prediction workflow of our MLP. つまり, the neural network turned a 1 by 64 into a 1 by 10.

- Loss
  - Input: a 1 by 10
  - Math: $L=-\sum_i y_i\log P_i=-\log P_{observe}$ since $y_i=[i=observe]$
  - Output: a scalar
  - Note: for a batch, the result is just the mean over the batch, giving the average error per sample while leaving the gradient scale unchanged.

```python
def relu(z: Array) -> Array:
    return np.maximum(z, 0)


def softmax(z: Array) -> Array:
    z_shift = z - z.max(axis=1, keepdims=True) # so the largest entry of exp will be 1 (normalization), preventing the exp become too large (too small is still unacceptable because we will have to calculate log(0).)
    # That’s why stable cross-entropy implementations work directly from logits, avoiding the intermediate step of computing a tiny probability and then taking its logarithm. (nn.CrossEntropyLoss())
    s = np.exp(z_shift).sum(axis=1, keepdims=True) # axis = the dimension that varies
    ans = np.exp(z_shift) / s # broadcast
    return ans


def forward(params: Params, X: Array) -> tuple[Array, Cache]: # Cache to calculate backpropagation
    z1 = X @ params['W1'] + params['b1']
    a1 = relu(z1)
    z2 = a1 @ params['W2'] + params['b2']
    probs = softmax(z2)
    return probs, {"z1": z1, "a1": a1, "z2": z2}


def cross_entropy(probs: Array, Y: Array) -> float | np.float64:
    return (-np.log(probs) * Y).sum(axis=1).mean()
```

## Backpropagation

I remember the program can figure out backpropagation by itself given forward process.

But anyway, let's do it. Chain rule: $\frac{dy}{dx}=\frac{dy}{du}\frac{du}{dx}$

- For Loss: $\frac{\partial}{\partial P_i}L=-\frac{1}{P_i}[i=observe]$
- For Softmax:

$$
\frac{\partial}{\partial Z_i}L=\sum_j\frac{\partial L}{\partial P_j}\frac{\partial P_j}{\partial Z_i}=\sum_j\frac{\partial L}{\partial P_j}P_i([i=j]-P_j)=P_i-[i=observe]
$$

- And what's left is a line of troublesome math calculation! I'll pass.

```python
def backward(params: Params, cache: Cache, X: Array, Y: Array) -> Params:
    # Softmax + cross-entropy: P - Y result, averaged over the batch once.
    dz2 = (softmax(cache["z2"]) - Y) / X.shape[0]  # (batch, n_out)
    dW2 = cache["a1"].T @ dz2                     # (n_hidden, n_out)
    db2 = dz2.sum(axis=0)                        # (n_out,)

    # Propagate through the second affine layer, then the elementwise ReLU.
    da1 = dz2 @ params["W2"].T                   # (batch, n_hidden)
    dz1 = da1 * (cache["z1"] > 0)                # (batch, n_hidden)
    dW1 = X.T @ dz1                             # (n_in, n_hidden)
    db1 = dz1.sum(axis=0)                        # (n_hidden,)

    return {"W1": dW1, "b1": db1, "W2": dW2, "b2": db2}
```

## Parameter Initialization

- If we set all parameters the same value, all neurons will be the same, receiving the same update.

- If we set $W_{ij}\sim\mathcal N(0,\sigma^2)$, assume $x_i$ and $W_{ij}$ are independent with zero mean, per $z_j=\sum_{i=1}^{64}x_iW_{ij}$, we get $\text{Var}(z_j)=64\text{Var}(x)\sigma^2$ (review squared variance of probability if you forget how to derive this), so the variance of activations grows by a factor of $\text{fan\_in}\cdot\sigma^2$.

- To control the variance, we need $\text{fan\_in}\cdot\sigma^2=1$.

- Conclusion:
  $$
  W\sim\mathcal N(0, \frac{1}{\text{fan\_in}})
  $$

- _TODO_: The detailed reason of why the variance must be controlled awaits future exploration.

```python
def init_params(
    n_in: int = 64, n_hidden: int = 32, n_out: int = 10, seed: int = 0
) -> Params: # Params is an alias of a kind of dict
    rng = np.random.default_rng(seed)
    W1 = rng.normal(loc = 0, scale = 1.0/math.sqrt(n_in), size = (n_in, n_hidden))
    b1 = np.zeros(n_hidden)
    W2 = rng.normal(loc = 0, scale = 1.0/math.sqrt(n_hidden), size = (n_hidden, n_out))
    b2 = np.zeros(n_out)
    return {'W1': W1, 'b1': b1, 'W2': W2, 'b2': b2}
```

## PyTorch Implementation

Model: a `nn.Module`

```python
class MLP(nn.Module):
    """Two affine layers, with an elementwise ReLU between them."""

    def __init__(self, n_in: int = 64, n_hidden: int = 32, n_out: int = 10) -> None:
        super().__init__()
        # Linear creates trainable weights/biases and initializes them for us.
        # It computes x @ weight.T + bias: its stored weight shape is (out, in).
        self.hidden = nn.Linear(n_in, n_hidden)
        self.output = nn.Linear(n_hidden, n_out)

    def forward(self, x: Tensor) -> Tensor:
        """Input: float32 (batch, n_in). Return: raw logits (batch, n_out)."""
        z1 = self.hidden(x)        # (batch, n_hidden), before activation
        a1 = torch.relu(z1)        # (batch, n_hidden)
        z2 = self.output(a1)       # (batch, n_out)
        return z2
```

Train

```python
def train(
    model: MLP, x: Tensor, y: Tensor, epochs: int = 30,
    batch_size: int = 32, lr: float = 0.5, seed: int = 42,
) -> list[float]:
    """Train in place; return the mean loss for each epoch.

    x: float32 (samples, n_in); y: int64 class indices (samples,).
    The model's device determines where each batch is processed.
    """
    device = next(model.parameters()).device
    loader = DataLoader(
        TensorDataset(x, y), batch_size=batch_size, shuffle=True,
        generator=torch.Generator().manual_seed(seed),
    )
    optimizer = torch.optim.SGD(model.parameters(), lr=lr)
    loss_function = nn.CrossEntropyLoss()  # mean loss over the actual batch
    history = []
    model.train()
    for epoch in range(epochs):
        total = 0.0
        for batch_x, batch_y in loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()             # clear the previous gradients
            logits = model(batch_x)           # forward
            loss = loss_function(logits, batch_y)
            loss.backward()                   # autograd fills parameter.grad
            optimizer.step()                  # SGD updates the parameters
            total += loss.item() * len(batch_x)
        history.append(total / len(x))
        if epoch % 5 == 0 or epoch == epochs - 1:
            print(f"epoch {epoch:3d}  loss {history[-1]:.4f}")
    return history
```

