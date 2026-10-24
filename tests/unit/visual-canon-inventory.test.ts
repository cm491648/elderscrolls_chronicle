// tests/unit/visual-canon-inventory.test.ts
// inventory.md is written by hand (or by a one-off script); this keeps its counts in step with subjects.json,
// the entries and refs.md so the planner of later phases is not misled by stale numbers.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORIES, loadEntries, parseRefs } from '../../scripts/visual-canon.mjs';

const subjects = Object.values(JSON.parse(readFileSync('docs/design/visual-canon/subjects.json', 'utf-8')) as Record<string, { phase: number; entries: string[] }>);
const inventory = readFileSync('docs/design/visual-canon/inventory.md', 'utf-8').replace(/\r\n/g, '\n');
const lines = inventory.split('\n');
const entries = loadEntries();
const CORE_BY_DECISION = new Set(['last-dragonborn']); // the user's decision (inventory.md 說明)

const uses = (id: string, phase: number) => subjects.filter((s) => s.phase === phase && s.entries.includes(id)).length;
const isCore = (id: string) => uses(id, 1) >= 1 || uses(id, 2) >= 3 || uses(id, 3) >= 3 || CORE_BY_DECISION.has(id);

/** Rows of every entry table: `| id | 中文名 | 英文名 | N（a／b／c） | 核心 | 參考圖 |`. */
const rows = new Map(
  lines
    .map((l) => l.match(/^\| ([a-z0-9-]+) \| [^|]+ \| [^|]+ \| (\d+)（(\d+)／(\d+)／(\d+)） \| ([^|]+) \| (\d+) \|$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], { total: +m[2], p1: +m[3], p2: +m[4], p3: +m[5], core: m[6].trim(), refs: +m[7] }] as const),
);

describe('inventory.md matches the canon', () => {
  test('has one row per entry and no row for a missing entry', () => {
    expect([...rows.keys()].sort()).toEqual([...entries.keys()].sort());
  });
  test('事件數, 核心 and 參考圖 match subjects.json and the entries', () => {
    for (const [id, row] of rows) {
      const p1 = uses(id, 1);
      const p2 = uses(id, 2);
      const p3 = uses(id, 3);
      expect({ id, total: row.total, p1: row.p1, p2: row.p2, p3: row.p3 }).toEqual({ id, total: p1 + p2 + p3, p1, p2, p3 });
      expect(row.core.startsWith('是'), `${id} 核心`).toBe(isCore(id));
      expect(row.refs, `${id} 參考圖`).toBe(entries.get(id)!.refs.length);
    }
  });
  test('category headings, the totals table and the unused list are current', () => {
    let core = 0;
    for (const category of CATEGORIES) {
      const ids = [...entries.values()].filter((e) => e.category === category).map((e) => e.id);
      const coreHere = ids.filter(isCore).length;
      core += coreHere;
      expect(inventory, category).toContain(`（\`${category}\`，${ids.length} 個）`);
      expect(lines, category).toContain(`| ${category} | ${ids.length} | ${coreHere} |`);
    }
    expect(lines).toContain(`| 合計 | ${entries.size} | ${core} |`);
    const unused = [...entries.keys()].filter((id) => uses(id, 1) + uses(id, 2) + uses(id, 3) === 0);
    const listed = inventory.match(/目前有 (\d+) 個條目沒有任何事件使用：([^。]+)。/)!;
    expect(+listed[1]).toBe(unused.length);
    expect(listed[2].split('、').sort()).toEqual(unused.sort());
  });
  test('the refs line counts refs.md rows and the refs entries use', () => {
    const refs = parseRefs(readFileSync('docs/design/visual-canon/refs.md', 'utf-8'));
    const used = new Set([...entries.values()].flatMap((e) => e.refs));
    expect(inventory).toContain(`參考圖共 ${refs.length} 張`);
    expect(inventory).toContain(`只算條目實際使用的 ${used.size} 張`);
  });
});
