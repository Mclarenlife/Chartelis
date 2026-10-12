import { expect, it } from 'vitest';
import { formatSource } from './formatting';
import { visualLineRange } from './focus-line';

it('formats only selected text and selects the inner content', () => {
  expect(formatSource('one two three', 4, 7, 'highlight')).toEqual({ from: 4, to: 7, insert: '==two==', anchor: 6, head: 9 });
});
it('replaces heading markers and formats multiple selected list lines', () => {
  expect(formatSource('## title', 3, 8, 'h3').insert).toBe('### title');
  expect(formatSource('first\nsecond', 0, 12, 'task').insert).toBe('- [ ] first\n- [ ] second');
});
it('focuses only one visual wrapped line within a long paragraph', () => {
  const coords = (pos: number) => ({ top: Math.floor(pos / 10) * 20, bottom: Math.floor(pos / 10) * 20 + 18 });
  expect(visualLineRange(0, 39, 15, coords)).toEqual({ from: 10, to: 20 });
  expect(visualLineRange(0, 39, 39, coords)).toEqual({ from: 30, to: 39 });
});
