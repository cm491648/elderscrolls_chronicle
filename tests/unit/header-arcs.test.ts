// tests/unit/header-arcs.test.ts
// The header's gold arcs are generated (scripts/make-header-arcs.mjs); the committed SVGs must match the script.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { headerArcs } from '../../scripts/make-header-arcs.mjs';

const file = (name: string) => readFileSync(`src/assets/ornaments/${name}`, 'utf-8').replace(/\r\n/g, '\n');

describe('header arcs (decisions/rings-2)', () => {
  test('the committed SVGs are what the script draws', () => {
    expect(file('header-arcs.svg')).toBe(headerArcs({ sway: true }));
    expect(file('header-arcs-still.svg')).toBe(headerArcs({ sway: false }));
  });
  test('only the swaying version moves, and it stops for readers who ask for less motion', () => {
    expect(headerArcs({ sway: true })).toMatch(/@keyframes sway[\s\S]*prefers-reduced-motion:reduce/);
    expect(headerArcs({ sway: false })).not.toContain('animation');
  });
  test('arcs only: no filled shapes such as star glints (the user asked for none)', () => {
    const svg = headerArcs({ sway: true });
    expect(svg).toContain('fill="none"');
    expect(svg).not.toMatch(/<(circle|polygon|rect|ellipse)\b/);
    expect(svg).not.toMatch(/\bfill="(?!none)/);
  });
});
