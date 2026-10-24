// tests/unit/fetch-refs.test.ts
import { describe, expect, test } from 'vitest';
import { planDownloads } from '../../scripts/fetch-refs.mjs';

describe('planDownloads', () => {
  const refs = [
    { id: 'legion-tes5-1', entry: 'imperial-legion', url: 'https://images.uesp.net/a/ab/SR-legion.jpg', note: 'x' },
    { id: 'alduin-tes5-1', entry: 'alduin', url: 'https://images.uesp.net/c/cd/SR-alduin.PNG', note: 'y' },
  ];
  test('skips files already downloaded and keeps the extension (lower case)', () => {
    expect(planDownloads(refs, ['legion-tes5-1.jpg'])).toEqual([{ id: 'alduin-tes5-1', url: refs[1].url, target: 'alduin-tes5-1.png' }]);
  });
});
