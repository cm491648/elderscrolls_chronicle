import { describe, expect, test } from 'vitest';
import { excerpt } from '../../src/lib/excerpt';

describe('excerpt', () => {
  test('short text is kept whole, without an ellipsis', () => {
    expect(excerpt('A short story.', 150)).toBe('A short story.');
  });
  test('English is cut at the last sentence end, else at a space, never mid-word', () => {
    const text = 'The first sentence is here. The second sentence goes on for quite a while longer than the limit allows';
    expect(excerpt(text, 40)).toBe('The first sentence is here.…');
    // A sentence end in the first half is too early to stop at: then the last space wins.
    expect(excerpt(text, 60)).toBe('The first sentence is here. The second sentence goes on for…');
    const words = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho';
    const out = excerpt(words, 40);
    expect(out.endsWith('…')).toBe(true);
    expect(words.startsWith(out.slice(0, -1))).toBe(true);
    expect(words[out.length - 1]).toBe(' ');
  });
  test('Chinese is cut after a sentence or clause mark, or at the limit', () => {
    const zh = '第一句話在這裡結束。第二句話很長很長，一直延續下去，超過了允許的長度很多很多很多很多很多';
    expect(excerpt(zh, 16)).toBe('第一句話在這裡結束。…');
    expect(excerpt(zh, 30)).toBe('第一句話在這裡結束。第二句話很長很長，一直延續下去…');
    const plain = '甲'.repeat(200);
    expect(excerpt(plain, 150)).toBe(`${'甲'.repeat(150)}…`);
  });
});
