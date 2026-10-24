import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Text sits on Codex's textures (decisions/es-feel-spec-2): check it against their darkest (paper) or lightest
// (leather) 5% instead of a flat colour, so a blotch in the texture can never sink small text below WCAG AA.
const tex = JSON.parse(readFileSync('src/assets/textures/textures.json', 'utf-8'));
const tokens = readFileSync('src/styles/tokens.css', 'utf-8');
const token = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test.each(['ink', 'ink-soft', 'accent', 'accent-2'])('--%s stays readable on the darkest of the paper', (name) => {
  expect(ratio(token(name), tex.vellum.dark)).toBeGreaterThanOrEqual(4.5);
});

test.each(['on-leather', 'on-leather-soft'])('--%s stays readable on the lightest of the leather', (name) => {
  expect(ratio(token(name), tex.leather.light)).toBeGreaterThanOrEqual(4.5);
});
