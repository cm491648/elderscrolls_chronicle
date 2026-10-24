// The Astro CLI's entry file, read from Astro's own package.json (it moved from astro.js to bin/astro.mjs in Astro 7),
// so scripts can run it with this Node directly (no shell): paths with spaces stay one argument.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pkgFile = require.resolve('astro/package.json');
const { bin } = require(pkgFile);
export const astroBin = path.join(path.dirname(pkgFile), typeof bin === 'string' ? bin : bin.astro);
