// Downloads the visual canon's reference images (docs/design/visual-canon/refs.md) into .superpowers/refs/.
// Reference only: the folder is git-ignored and never published.
// Usage: node scripts/fetch-refs.mjs [--refs <refs.md>] [--out <dir>]
// Do not run two copies at once on the same folder (they would download the same files twice). Startup only
// removes `.part` leftovers older than 10 minutes, so a copy that is running at the same time is left alone.
import { createWriteStream, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { superpowersDir } from './superpowers-dir.mjs';
import { CANON_DIR, parseRefs } from './visual-canon.mjs';

const REFS_DIR = path.join(superpowersDir(), 'refs');
const USER_AGENT = 'elderscrolls-chronicle fan project (reference images)';
const IDLE_TIMEOUT_MS = 30000;
const STALE_PART_MS = 10 * 60 * 1000;

export function planDownloads(refs, existingFiles) {
  const have = new Set(existingFiles.map((f) => f.replace(/\.[^.]+$/, '')));
  return refs
    .filter((r) => !have.has(r.id))
    .map((r) => ({ id: r.id, url: r.url, target: `${r.id}${path.extname(new URL(r.url).pathname).toLowerCase()}` }));
}

// Streams `url` to `dest` through a `.part` file (renamed on success, removed on failure).
// Follows redirects, requires HTTP 200, and fails if the connection is idle for IDLE_TIMEOUT_MS
// or the body is shorter than Content-Length. Node's built-in fetch stalls on some UESP images here.
export function downloadFile(url, dest, redirectsLeft = 5) {
  const part = `${dest}.part`;
  return new Promise((resolve, reject) => {
    let settled = false;
    let out = null;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.destroy();
      out?.destroy();
      rmSync(part, { force: true });
      reject(err);
    };
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return fail(new Error('too many redirects'));
        let next;
        try {
          next = new URL(res.headers.location, url).href;
        } catch (e) {
          return fail(e);
        }
        settled = true;
        return downloadFile(next, dest, redirectsLeft - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return fail(new Error(`HTTP ${res.statusCode}`));
      }
      const expected = Number(res.headers['content-length'] ?? -1);
      let size = 0;
      out = createWriteStream(part);
      res.on('data', (c) => (size += c.length));
      res.on('error', fail);
      out.on('error', fail);
      // Rename on 'close' (file descriptor released); a rename error (e.g. Windows EPERM/EBUSY) fails this one file only.
      out.on('close', () => {
        if (settled) return;
        try {
          if (expected >= 0 && size !== expected) throw new Error(`short body ${size}/${expected}`);
          renameSync(part, dest);
        } catch (e) {
          return fail(e);
        }
        settled = true;
        resolve(size);
      });
      res.pipe(out);
    });
    req.setTimeout(IDLE_TIMEOUT_MS, () => req.destroy(new Error(`idle for ${IDLE_TIMEOUT_MS / 1000}s`)));
    req.on('error', fail);
  });
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const refsFile = argValue('--refs') ?? path.join(CANON_DIR, 'refs.md');
  const outDir = argValue('--out') ? path.resolve(argValue('--out')) : REFS_DIR;
  mkdirSync(outDir, { recursive: true });
  // Only sweep leftovers that are clearly stale, so a copy running at the same time is not disturbed.
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.part') && Date.now() - statSync(path.join(outDir, f)).mtimeMs > STALE_PART_MS) rmSync(path.join(outDir, f), { force: true });
  }
  const refs = parseRefs(readFileSync(refsFile, 'utf-8'));
  const todo = planDownloads(refs, readdirSync(outDir));
  let failed = 0;
  for (const d of todo) {
    try {
      const dest = path.join(outDir, d.target);
      await downloadFile(d.url, dest);
      console.log(`ok   ${d.target}  ${statSync(dest).size} bytes`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${d.id}  ${d.url}  ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`done: ${todo.length - failed} downloaded, ${failed} failed, ${refs.length - todo.length} already there`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
