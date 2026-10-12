// Find the actual wrapped screen line, rather than emphasizing an entire paragraph.
export function visualLineRange(start: number, end: number, head: number, coords: (position: number) => { top: number; bottom: number }) {
  const current = coords(head);
  const middle = (current.top + current.bottom) / 2;
  const lowerBound = (predicate: (position: number) => boolean) => {
    let low = start, high = end;
    while (low < high) { const mid = Math.floor((low + high) / 2); if (predicate(mid)) high = mid; else low = mid + 1; }
    return low;
  };
  return { from: lowerBound(pos => coords(pos).bottom > middle), to: lowerBound(pos => coords(pos).top > middle) };
}
