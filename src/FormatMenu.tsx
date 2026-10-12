import { useEffect, useRef, useState } from 'react';
import { formatGroups, linkMarkdown, type FormatAction, type FormatValue } from './formatting';

export function LinkDialog({ action, onInsert, onClose }: { action: 'link' | 'image'; onInsert(value: FormatValue): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState(''), [text, setText] = useState(''), [error, setError] = useState('');
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  return <dialog ref={dialog} className="modal" aria-label={action === 'image' ? '插入图片' : '插入链接'} onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); try { const value = { url, text: text || (action === 'image' ? '图片' : url) }; linkMarkdown(action, value); onInsert(value); } catch (error) { setError(String(error)); } }}>
      <h2>{action === 'image' ? '插入图片' : '插入链接'}</h2>
      <label className="link-field">{action === 'image' ? '图片地址' : '链接地址'}<input autoFocus required placeholder="https://" value={url} onChange={event => setUrl(event.target.value)} /></label>
      <label className="link-field">{action === 'image' ? '图片描述' : '显示文字'}<input value={text} onChange={event => setText(event.target.value)} /></label>
      {error && <p role="alert" className="cache-warning">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">插入</button></div>
    </form>
  </dialog>;
}

export default function FormatMenu({ x, y, onSelect, onClose }: { x: number; y: number; onSelect(action: FormatAction): void; onClose(): void }) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) onClose(); };
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('scroll', scroll, true); };
  }, [onClose]);
  return <div ref={menu} className="format-menu" role="menu" aria-label="Markdown 格式" style={{ left: Math.max(8, Math.min(x, window.innerWidth - 350)), top: Math.max(8, Math.min(y, window.innerHeight - 470)) }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const buttons = [...menu.current!.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  }}>
    {formatGroups.map(group => <div className="format-group" key={group.label}><span>{group.label}</span><div>{group.items.map(([action, label]) => <button key={action} role="menuitem" onMouseDown={event => event.preventDefault()} onClick={() => onSelect(action)}>{label}</button>)}</div></div>)}
  </div>;
}
