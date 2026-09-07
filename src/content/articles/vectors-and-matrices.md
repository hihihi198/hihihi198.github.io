---
title: "*Introduction to Linear Algebra* Review"
date: 2026-07-22
summary: A=CR
tags: [review, linear-algebra]
draft: true
---

# Vectors and Matrices

Notation: $C(A)$ is the column space of $A$.

Key points:

- $A=CR$
- $A\mathbf x=\mathbf b$. We know $A\mathbf x$ can represent all vectors in $C(A)$. So if $A\mathbf x=\mathbf b$ is solvable, $\mathbf b$ is in $C(A)$.
- $CR=\sum_{k=1}^n\mathbf c_k\mathbf r_k$

# Solving Linear Equations $A\mathbf x=\mathbf b$

Consider $A\mathbf x=\mathbf 0$. If the column vectors of $A$ are dependent ($A$ does not have full rank), there will be non-zero solutions, which means $A\mathbf x=\mathbf b$ will have multiple solutions if solvable.

- Elimination (in each column) to $U\mathbf x=\mathbf c$ and back substitution.

  - A triangular matrix $U$ has full rank exactly when its main diagonal has no zeros.
  - The overall equation is $PA=LU$. $L$ is lower triangle and $U$ is upper triangle.

- Elimination multiplies $A$ by $E_{21},\cdots,E_{n1}$ then $E_{32},\cdots,E_{n2}$ as $A$ becomes $EA=U$

  - In reverse order, $A=E^{-1}U$. This is $A=LU$, then $A\mathbf x=\mathbf b$ becomes $\mathbf x=U^{-1}L^{-1}\mathbf b$.

  - For $E=E_{32}E_{31}E_{21}$ ($E_{32}=\begin{bmatrix}
    1&0&0\\
    0&1&0\\
    0&-l_{32}&1
    \end{bmatrix}$), reverse order is the good way: $L=\begin{bmatrix}
    1&0&0\\
    l_{21}&1&0\\
    l_{31}&l_{32}&1
    \end{bmatrix}$

  - How to understand this? When doing elimination, we subtract $l_{ij}$ times the $j$-th row from the $i$-th row. During this process, the previous $j-1$ rows won't be affected. So if we do this in reverse order, the next operations happening in the first $j-1$ rows won't be affected.
- The permutation matrix $P$ is an orthogonal matrix, satisfying $P^{-1}=P^T$. Columns (or rows) of $P$ form an orthonormal set.
- To be Learned: **2.5 Derivatives and Finite Difference Matrices**

# The Four Fundamental Subspaces

- Vector Spaces' requirement: all linear combinations $c\mathbf v+d\mathbf w$ must stay in the vector space.
- The row space of A is "spanned" by the rows of $A$.

## Computing the Nullspace by Elimination: $A=CR$

- The nullspace $N(A)$ in $\mathbb R^n$ contains all solutions $x$ to $A\mathbf x=\mathbf 0$. We will find $n-r$ in the nullspace of $A$—special solutions to $A\mathbf x=\mathbf 0$
- Elimination from $A$ to $R_0$ to $R$ does not change the nullspace: $N(A)=N(R_0)=N(R)$
- Reduced Row Echelon Form: multiply $W^{-1}A=W^{-1}[W\quad H]$ to produce $R=[I\quad W^{-1}H]=[I\quad F]$
- Elimination algorithm:
  - First $k$ columns $\begin{bmatrix}I_k&F_k\\0&0\\\end{bmatrix}P_k$ followed by the $(k+1)$-th column $\begin{bmatrix}\mathbf u\\\mathbf l\\\end{bmatrix}$
  - If $\mathbf l$ is all zeros, the new column is dependent. Then $\mathbf u$ joins $F_k$ to produce $F_{k+1}$.
  - If $\mathbf l$ is not all zero, the new column is independent. Pick any nonzero in $\mathbf l$. Move that row of $A$ up into row $k+1$. Do the elimination for the new column, which then joins with $I_k$ to produce $I_{k+1}$.
- At the end of elimination, we have a most desirable list of column numbers, telling the first $r$ independent columns of $A$, which are the columns of $C$ in $A=CR$.
- Solutions to $[I_r\quad F]P\mathbf x=0$ (the $m-r$ zero rows of $R_0$ have been removed) are columns of $P^T\begin{bmatrix}-F\\I_{n-r}\\\end{bmatrix}$. Or, we set the $n-r$ free variables in $\mathbf x$ to get the solutions.

## The Complete Solution to $A\mathbf x=\mathbf b$

- Complete solution: $\mathbf x=$ one particular solution + any $\mathbf x_n$ in the nullspace.
- Elimination on $A\mathbf x=\mathbf b$ leads to $R_0\mathbf x=\mathbf d$: Solvable when zero rows of $R_0$ have zeros in $\mathbf d$. When solvable, one very particular solution $x_p$ has all free variables equal to zero.
- A has full column rank $r=n$ when its nullspace $N(A)=0$

## Independence, Basis, and Dimension

- The vectors are a basis for $S$ if (1) they are independent and (2) they span $S$.
- The dimension of a vector space $S$ is the number $k$ of vectors in every basis for $S$.

## Dimensions of the Four Subspaces

The four fundamental subspaces are $C(A^T), C(A), N(A), N(A^T)$.

Suppose we fix $C$ and $B$ ($m$ by $r$ and $r$ by $n$, both rank $r$). Choose any invertible $r$ by $r$ mixing matrix $M$. All the matrices $CMB$ (and only those) have the same four fundamental subspaces.
