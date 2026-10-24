import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { MAX_FILES, countFiles } from '../../scripts/artifact-files.mjs';

const dirs: string[] = [];
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

test('the export stays well under the artifact host limit of about 512 files', () => {
  expect(MAX_FILES).toBe(490);
});

test('files are counted by extension, in every folder', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'artifact-files-'));
  dirs.push(dir);
  await mkdir(path.join(dir, 'en', 'events'), { recursive: true });
  for (const f of ['index.html', 'en/index.html', 'en/events/a.html', 'x.webp', 'en/y.webp', 'stories.json', 'LICENSE']) {
    await writeFile(path.join(dir, f), '');
  }
  expect(await countFiles(dir)).toEqual({ total: 7, '.html': 3, '.webp': 2, '.json': 1, '(none)': 1 });
});
