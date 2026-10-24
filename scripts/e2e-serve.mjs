// Builds and serves two copies of the site for the e2e suite (playwright.config.ts):
//   :4321  the site as published (dist/)
//   :4322  the same site with PUBLIC_MAP_SOURCE=drawn (dist-e2e/), i.e. without the official Tamriel map
// Builds run one after the other (they share Astro's cache); both previews stay up until Playwright stops this.
import { spawn, spawnSync } from 'node:child_process';
import { astroBin } from './astro-bin.mjs';

// Run Astro's CLI with this Node directly (no shell): arguments with spaces stay intact, and stopping the
// children stops the previews themselves rather than a shell wrapped around them.
const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, [astroBin, ...args], { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(['build']);
run(['build', '--outDir', 'dist-e2e'], { PUBLIC_MAP_SOURCE: 'drawn' });

const preview = (args) => spawn(process.execPath, [astroBin, 'preview', ...args], { stdio: 'inherit' });
const children = [preview(['--port', '4321']), preview(['--outDir', 'dist-e2e', '--port', '4322'])];
const stop = () => {
  for (const c of children) c.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const c of children) c.on('exit', (code) => code && process.exit(code));
