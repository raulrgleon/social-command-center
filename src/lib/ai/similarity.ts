const STOP = new Set("de la el los las un una y o a en que del al para por con sin sobre entre ya no si".split(" "));

export function tokens(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9#@]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP.has(token));
}

export function jaccard(a: string, b: string) {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function findDuplicates(candidate: string, existing: Array<{ id: string; text: string }>, threshold = 0.72) {
  return existing
    .map((item) => ({ id: item.id, score: jaccard(candidate, item.text) }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function suggestHashtags(text: string, limit = 8) {
  const counts = new Map<string, number>();
  for (const token of tokens(text)) {
    if (token.startsWith("@")) continue;
    const word = token.replace(/^#/, "");
    if (word.length < 4) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}
