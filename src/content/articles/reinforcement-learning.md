---
title: "Reinforcement Learning Basics"
date: 2026-07-22
summary: One line, on cards.
tags: [essay, reinforcement-learning, machine-learning]
draft: true
---

# Markov Decision Process (MDP)

The process models an agent following $s_0, a_0, s_1, a_1,\cdots$:
$$
\mathcal M=(\mathcal S, \mathcal A, P, R,\gamma)
$$
Where

- $\mathcal S$: set of states
- $\mathcal A$: set of actions
- $P(s'|s,a)$: transition probability. (Markov property: the past is irrelevant for predicting the next state)
- $R(s,a,s')$: reward
- $\gamma\in[0,1]$: discount factor

The objective of the agent is maximize the return
$$
G_t=\sum_{k=0}^{\infty}\gamma^kr_{t+k+1}
$$

## Policy

A rule for deciding what to do is a policy: probability of choosing $a$ under state $s$:
$$
\pi(a|s)
$$
The goal of RL: to find the best policy
$$
\pi^*=\arg\max_{\pi}\mathbb E_{\pi}(G_t)
$$

## Value Functions

Turning "expected return" into computable quantities.

Define the **state-value** function and **action-value** function:
$$
V^{\pi}(s)=\mathbb E_{\pi}[G_t\mid S_t=s]\qquad Q^{\pi}(s, a)=\mathbb E_{\pi}[G_t\mid S_t=s, A_t=a]
$$
Their relationship:
$$
V^{\pi}(s)=\sum_a\pi(a|s)Q^{\pi}(s,a)\\
Q^{\pi}(s,a)=\sum_{s'}P(s'|s,a)[R(s,a,s')+\gamma V^{\pi}(s')]
$$
So
$$
V^{\pi}(s)=\sum_a\pi(a|s)\sum_{s'}P(s'|s,a)[R(s,a,s')+\gamma V^{\pi}(s')]
$$
This is the **Bellman expectation equation**.

## Bellman Optimality

Replacing "average over $\pi$" with "max over actions" gives the Bellman optimally equation:
$$
V^*(s)=\max_{a}\sum_{s'}P(s'|s,a)[R(s,a,s')+\gamma V^*(s')]
$$

$$
Q^*(s,a)=\sum_{s'}P(s'|s,a)[R(s,a,s')+\gamma\max_{a'}Q^*(s',a')]
$$

As long as we solve $V^*$ or $Q^*$, we will get the optimal policy. 

Bellman optimality operator $T^*$:
$$
(T^*V)(s)=\max_a\sum_{s'}P(s'|s,a)[R(s, a, s')+\gamma V(s')]
$$
Obviously, if $V$ is not optimal, $T^*V$ is not necessary optimal because it still evaluate the value of $s'$ with $V$. **However, its fixed point is the true optimal value function:**
$$
V^*=T^*V^*
$$
The crucial theorem is that for a discounted finite MDP, $T^*$ is a contraction:
$$
\big|(T^* V)(s) - (T^* U)(s)\big| \le \gamma \max_{s'} |V(s') - U(s')| = \gamma \|V - U\|_\infty
$$
Since $\gamma < 1$, it has exactly one fixed point, and repeated application of $T$ converges to it geometrically. That's why value iteration (VI) works.

## Learning with Unknown $P$ and $R$

With unknown $P$, you must learn from experience, or learn a model.
