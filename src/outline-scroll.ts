// Outline navigation always aligns, even when the selection is already visible.
// Scroll the document viewport only; never scroll the surrounding window/sidebar.
const pending = new WeakMap<HTMLElement, number>();
export function scrollOutlineTarget(editor: HTMLElement, targetTop: () => number) {
  const scroller = editor.closest<HTMLElement>('.writing-scroll');
  if (!scroller) return;
  cancelAnimationFrame(pending.get(scroller) ?? 0);
  const align = () => {
    if (!editor.isConnected || !scroller.getClientRects().length) return;
    const rect = scroller.getBoundingClientRect();
    const panel = scroller.closest('.main-panel');
    const header = panel?.querySelector('.topbar:not([hidden]), .window-strip')?.getBoundingClientRect();
    const footer = panel?.querySelector('.statusbar:not([hidden])')?.getBoundingClientRect();
    const top = Math.max(rect.top, header?.bottom ?? rect.top);
    const bottom = Math.min(rect.bottom, footer?.top ?? rect.bottom);
    const destination = top + Math.max(0, bottom - top) * .25;
    scroller.scrollTop += targetTop() - destination;
  };
  align();
  // CodeMirror measures virtualized lines on the next frame; align once more
  // after those measurements, and supersede earlier rapid outline clicks.
  pending.set(scroller, requestAnimationFrame(() => {
    align();
    pending.set(scroller, requestAnimationFrame(() => { align(); pending.delete(scroller); }));
  }));
}
