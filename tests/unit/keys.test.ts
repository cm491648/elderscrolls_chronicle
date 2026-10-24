import { describe, expect, test } from 'vitest';
import { ownsArrowKeys } from '../../src/lib/keys';

type Fake = { tagName: string; type?: string; isContentEditable?: boolean; closest?: (s: string) => unknown };
const el = (f: Fake) => ({ isContentEditable: false, closest: () => null, ...f }) as unknown as Element;
/** A button whose ancestors match exactly one selector, as Element.closest would see them. */
const inside = (selector: string) =>
  el({ tagName: 'BUTTON', closest: (s: string) => (s.split(',').map((x) => x.trim()).includes(selector) ? {} : null) });

describe('ownsArrowKeys', () => {
  test.each(['INPUT', 'TEXTAREA', 'SELECT'])('form field %s keeps its arrows', (tagName) => {
    expect(ownsArrowKeys(el({ tagName }))).toBe(true);
  });
  test('inputs that do not use arrows (checkboxes, buttons) leave them to the chronicle', () => {
    for (const type of ['checkbox', 'button', 'submit', 'reset'])
      expect(ownsArrowKeys(el({ tagName: 'INPUT', type })), type).toBe(false);
    for (const type of ['text', 'search', 'radio', 'range', 'number'])
      expect(ownsArrowKeys(el({ tagName: 'INPUT', type })), type).toBe(true);
  });
  test('a checkbox inside a panel that claims its arrows still keeps them', () => {
    expect(ownsArrowKeys(el({ tagName: 'INPUT', type: 'checkbox', closest: (s) => (s.includes('[data-own-arrows]') ? {} : null) }))).toBe(true);
  });
  test('editable text keeps its arrows', () => {
    expect(ownsArrowKeys(el({ tagName: 'DIV', isContentEditable: true }))).toBe(true);
  });
  test.each(['slider', 'spinbutton', 'textbox', 'searchbox', 'listbox', 'option', 'combobox', 'menu', 'menubar',
    'radiogroup', 'tablist', 'grid', 'tree'])('anything inside role=%s keeps its arrows', (role) => {
    expect(ownsArrowKeys(inside(`[role="${role}"]`))).toBe(true);
  });
  test('a panel can claim its arrows with data-own-arrows', () => {
    expect(ownsArrowKeys(inside('[data-own-arrows]'))).toBe(true);
  });
  test('plain buttons, links and the page leave arrows to the chronicle', () => {
    expect(ownsArrowKeys(el({ tagName: 'BUTTON' }))).toBe(false);
    expect(ownsArrowKeys(el({ tagName: 'A' }))).toBe(false);
    expect(ownsArrowKeys(el({ tagName: 'BODY' }))).toBe(false);
    expect(ownsArrowKeys(inside('[role="button"]'))).toBe(false);
  });
  test('a target that is not an element (window, document) leaves arrows to the chronicle', () => {
    expect(ownsArrowKeys(null)).toBe(false);
    expect(ownsArrowKeys({} as unknown as Element)).toBe(false);
  });
});
