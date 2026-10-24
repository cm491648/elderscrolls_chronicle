// The .superpowers folder (reference images, image samples, review records; never committed) lives only in the main
// checkout. Scripts run in a worktree reach it there by full path instead of through a link in the worktree, so removing
// a worktree can never delete it (decisions/sp-recovery: a linked .superpowers was wiped that way on 2026-10-24).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));

/** `<main checkout>/.superpowers`, from git's common directory; this checkout's own folder if git cannot say. */
export function superpowersDir(cwd = REPO) {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.join(path.dirname(common), '.superpowers');
  } catch {
    return path.join(REPO, '.superpowers');
  }
}
