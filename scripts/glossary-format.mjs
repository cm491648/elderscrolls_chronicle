// src/content/glossary.json keeps one entry per line, written like `{"id": "x", "name": {...}}`, so a change to one
// term is a one-line diff. Scripts that rewrite the file use this to keep that layout.

/** One JSON value in the glossary's inline style: ", " between items, ": " after keys. */
function inline(value) {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')}}`;
  return JSON.stringify(value);
}

/** The whole file: a JSON array, one entry per line, with a trailing newline. */
export function formatGlossary(rows) {
  return `[\n${rows.map((r) => `  ${inline(r)}`).join(',\n')}\n]\n`;
}
