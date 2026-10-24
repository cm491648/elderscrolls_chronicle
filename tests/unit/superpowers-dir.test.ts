import { statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { superpowersDir } from '../../scripts/superpowers-dir.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

test('.superpowers is the main checkout\'s, next to the real .git folder, even when run from a worktree', () => {
  const dir = superpowersDir();
  expect(path.basename(dir)).toBe('.superpowers');
  expect(statSync(path.join(path.dirname(dir), '.git')).isDirectory()).toBe(true);
});

test('outside any git checkout it falls back to this checkout\'s own folder', () => {
  expect(path.resolve(superpowersDir(tmpdir()))).toBe(path.resolve(REPO, '.superpowers'));
});
