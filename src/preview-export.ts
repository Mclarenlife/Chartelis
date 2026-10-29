export interface PreviewSnapshot { html: string; width: number; font: string; variables: Record<string, string> }
export function capturePreview(html: string, font: string): PreviewSnapshot {
  const app = document.querySelector<HTMLElement>('.app');
  const session = document.querySelector<HTMLElement>('.document-session:not([hidden])');
  const style = getComputedStyle(app ?? document.documentElement);
  const variables: Record<string, string> = {};
  for (const name of ['paper', 'sidebar', 'text', 'muted', 'subtle', 'line', 'hover', 'selected', 'accent', 'accent-soft', 'gold', 'surface', 'highlight-color', 'editor-max-width', 'editor-font-size', 'writing-color', 'writing-line', 'writing-spacing']) variables[`--${name}`] = style.getPropertyValue(`--${name}`);
  return { html, width: session?.clientWidth || 832, font, variables };
}
/** The same page, Milkdown classes and tokens as the editor, without transient UI. */
export function createPreviewSurface(snapshot: PreviewSnapshot) {
  const surface = document.createElement('div');
  surface.className = 'preview-export';
  Object.assign(surface.style, { position: 'absolute', left: '-100000px', top: '0', width: `${snapshot.width}px`, background: 'var(--paper)', color: 'var(--text)', pointerEvents: 'none' });
  for (const [name, value] of Object.entries(snapshot.variables)) if (value) surface.style.setProperty(name, value);
  const article = document.createElement('article'); article.className = `writing-page font-${snapshot.font === 'sans' ? 'sans' : 'serif'}`;
  const milkdown = document.createElement('div'); milkdown.className = 'milkdown';
  const editor = document.createElement('div'); editor.className = 'ProseMirror'; editor.innerHTML = snapshot.html;
  milkdown.append(editor); article.append(milkdown); surface.append(article); document.body.append(surface);
  // Preserve the editor's text width and wrapping, but omit unused window space.
  const textWidth = article.getBoundingClientRect().width;
  article.style.width = `${textWidth}px`;
  surface.style.width = `${textWidth + 96}px`;
  return surface;
}
