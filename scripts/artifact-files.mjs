// File counting for the claude.ai artifact export (scripts/artifact-export.mjs). An artifact version holds about 512
// files; the export refuses to go past MAX_FILES so a growing site fails here, not at publish time.
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const MAX_FILES = 490;

/** Files under `dir` by extension ('.webp', '.json', …; '(none)' for no extension), plus `total`. */
export async function countFiles(dir) {
  const counts = { total: 0 };
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name) || '(none)';
    counts[ext] = (counts[ext] ?? 0) + 1;
    counts.total++;
  }
  return counts;
}
