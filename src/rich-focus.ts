import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { visualLineRange } from './focus-line';

const focusKey = new PluginKey<DecorationSet>('chartelis-focus');
export function richFocus(enabled: () => boolean) {
  return $prose(() => new Plugin({
    key: focusKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) { return tr.getMeta(focusKey) ?? old.map(tr.mapping, tr.doc); },
    },
    props: { decorations: state => focusKey.getState(state) },
    view(view) {
      let frame = 0, disposed = false, previous = '';
      const measure = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (disposed || view.isDestroyed || !view.dom.getClientRects().length) return;
          let from = 0, to = 0;
          const $head = view.state.selection.$head;
          if (enabled() && $head.parent.isTextblock) {
            try { ({ from, to } = visualLineRange($head.start(), $head.end(), $head.pos, pos => view.coordsAtPos(pos))); } catch { return; }
          }
          const signature = `${from}:${to}:${view.state.doc.content.size}:${enabled()}`;
          if (signature === previous) return;
          previous = signature;
          const decorations = from < to ? DecorationSet.create(view.state.doc, [Decoration.inline(from, to, { class: 'focus-current' })]) : DecorationSet.empty;
          view.dispatch(view.state.tr.setMeta(focusKey, decorations).setMeta('addToHistory', false));
        });
      };
      const observer = new ResizeObserver(measure); observer.observe(view.dom);
      measure();
      return { update: measure, destroy() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); } };
    },
  }));
}
