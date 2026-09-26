/**
 * Yields every k-length combination of items, in lexicographic index order.
 * Used to enumerate opponent hands / remaining board cards without allocating
 * the full combinatorial set up front.
 */
export function* combinations<T>(items: readonly T[], k: number): Generator<T[]> {
  const n = items.length;
  if (k < 0 || k > n) return;
  if (k === 0) {
    yield [];
    return;
  }
  const indices = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield indices.map((i) => items[i]);

    let i = k - 1;
    while (i >= 0 && indices[i] === n - k + i) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
  }
}

export function countCombinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}
