import { describe, expect, test } from 'vitest';
import { addCsp, addHints, cspFor, fontPreloads, islandModules, moduleClosure, staticImports } from '../../scripts/head-hints.mjs';

describe('staticImports', () => {
  test('minified named, bare and side-effect imports; not dynamic ones', () => {
    const code =
      'import{i as e,n as t}from"./preact.module.D350.js";import{a as o}from"./hooks.module.D7.js";import"./side.js";' +
      'const x=()=>import("./lazy.js");';
    expect(staticImports(code)).toEqual(['./preact.module.D350.js', './hooks.module.D7.js', './side.js']);
  });
});

describe('moduleClosure', () => {
  test('follows imports once each, depth first', async () => {
    const files: Record<string, string> = {
      '/_astro/App.js': 'import{a}from"./preact.js";import{b}from"./Header.js";',
      '/_astro/Header.js': 'import{a}from"./preact.js";',
      '/_astro/preact.js': 'export const a=1;',
    };
    const closure = await moduleClosure('/_astro/App.js', async (u: string) => files[u] ?? null);
    expect(closure).toEqual(['/_astro/App.js', '/_astro/preact.js', '/_astro/Header.js']);
  });
});

describe('islandModules', () => {
  test('component and renderer of every island, once', () => {
    const html =
      '<astro-island uid="a" component-url="/b/_astro/App.js" renderer-url="/b/_astro/client.js" ssr>' +
      '<astro-island uid="c" component-url="/b/_astro/Header.js" renderer-url="/b/_astro/client.js">';
    expect(islandModules(html)).toEqual(['/b/_astro/App.js', '/b/_astro/client.js', '/b/_astro/Header.js']);
  });
});

describe('fontPreloads and addHints', () => {
  test('the Latin title and text faces, in that order', () => {
    const css =
      '@font-face{src:url(/_astro/alegreya-sans-latin-400-normal.Dt.woff2)}@font-face{src:url(/_astro/alegreya-latin-ext-700-normal.X.woff2)}' +
      '@font-face{src:url(/_astro/alegreya-latin-700-normal.Vp.woff2)}';
    expect(fontPreloads(css)).toEqual(['/_astro/alegreya-latin-700-normal.Vp.woff2', '/_astro/alegreya-sans-latin-400-normal.Dt.woff2']);
  });
  test('inserted before </head>, only once', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';
    const once = addHints(html, { modules: ['/_astro/App.js'], fonts: ['/_astro/f.woff2'] });
    expect(once).toContain('<link rel="modulepreload" href="/_astro/App.js" data-head-hints>');
    expect(once).toContain('<link rel="preload" as="font" type="font/woff2" href="/_astro/f.woff2" crossorigin data-head-hints></head>');
    expect(addHints(once, { modules: ['/_astro/Other.js'] })).toBe(once);
  });
});

describe('cspFor and addCsp', () => {
  const page =
    '<html><head><meta charset="utf-8"><script>run()</script><script type="application/json">{"a":1}</script>' +
    '<script type="module">go()</script><script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>' +
    '<style>a{color:red}</style></head><body></body></html>';
  test('hashes the inline scripts the browser runs and the inline styles; allows the beacon only where it is', async () => {
    const { createHash } = await import('node:crypto');
    const h = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;
    const csp = cspFor(page);
    expect(csp).toContain(`script-src 'self' ${h('run()')} ${h('go()')} https://static.cloudflareinsights.com;`);
    expect(csp).not.toContain(h('{"a":1}'));
    expect(csp).toContain(`style-src 'self' ${h('a{color:red}')};`);
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com");
    expect(cspFor('<script>x()</script>')).not.toContain('cloudflareinsights');
  });
  test('placed right after the charset, once', () => {
    const out = addCsp(page);
    expect(out).toMatch(/^<html><head><meta charset="utf-8"><meta http-equiv="content-security-policy" content="default-src 'self'; /);
    expect(addCsp(out)).toBe(out);
  });
});
