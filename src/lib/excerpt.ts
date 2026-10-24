/**
 * A meta description: the text cut to at most `max` characters, on a boundary, with an ellipsis when cut. Latin text
 * breaks after the last sentence end or space in the second half of the limit; Chinese text (no spaces) after the
 * last sentence or clause mark, else at the limit itself.
 */
export function excerpt(text: string, max = 150): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const head = flat.slice(0, max);
  const floor = Math.floor(max / 2);
  const sentence = Math.max(...['. ', '。', '！', '？', '! ', '? '].map((m) => head.lastIndexOf(m)));
  if (sentence >= floor) return `${head.slice(0, sentence + 1).trim()}…`;
  const space = head.lastIndexOf(' ');
  const clause = Math.max(head.lastIndexOf('，'), head.lastIndexOf('、'), head.lastIndexOf('；'));
  const cut = space >= floor ? space : clause >= floor ? clause : max;
  return `${head.slice(0, cut).replace(/[\s,;:，、；：]+$/, '')}…`;
}
