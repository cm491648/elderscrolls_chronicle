/** Folds what readers type differently: case, full-width forms, spaces, name dots (·・) and apostrophes. */
function fold(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[\s·・'’‘`\-]/g, '');
}

/** Whether an item (its names in both languages) matches what the reader typed; an empty query matches all. */
export function matches(haystack: string, query: string): boolean {
  const q = fold(query);
  return q === '' || fold(haystack).includes(q);
}
