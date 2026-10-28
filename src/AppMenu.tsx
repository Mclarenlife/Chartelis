import { t, tf } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { File, Pencil, PanelLeft, CircleHelp, ChevronRight, Check } from 'lucide-react';
export interface MenuItem { label: string; shortcut?: string; action?: () => void; disabled?: boolean; checked?: boolean; children?: MenuItem[]; separator?: boolean }
export type MenuGroups = Record<'文件' | '编辑' | '视图' | '帮助', MenuItem[]>;
export default function AppMenu({ groups }: { groups: MenuGroups }) {
  const [opened, setOpened] = useState<{ name: keyof MenuGroups; x: number; y: number } | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null), grid = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const close = () => { setOpened(null); setBranch(null); trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!opened) return;
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !grid.current?.contains(event.target as Node)) { setOpened(null); setBranch(null); } };
    const resize = () => { setOpened(null); setBranch(null); };
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [opened, branch]);
  const icons = [File, Pencil, PanelLeft, CircleHelp];
  const items = opened ? (branch ? groups[opened.name].find(item => item.label === branch)?.children || [] : groups[opened.name]) : [];
  return <>
    <div className="app-menu-bar" aria-label={t("应用菜单")} ref={grid}>{(Object.keys(groups) as (keyof MenuGroups)[]).map((name, i) => { const Icon = icons[i]; return <button key={name} aria-haspopup="menu" aria-expanded={opened?.name === name} onMouseDown={e => e.preventDefault()} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); trigger.current = event.currentTarget; setBranch(null); setOpened(opened?.name === name ? null : { name, x: rect.left, y: rect.bottom + 6 }); }}><Icon size={16} /><span>{t(name)}</span></button>; })}</div>
    {opened && createPortal(<div className="app-menu-panel" ref={panel} role="menu" aria-label={tf`${t(opened.name)}菜单`} style={{ left: Math.max(8, Math.min(opened.x, window.innerWidth - 290)), top: opened.y, maxHeight: Math.max(80, window.innerHeight - opened.y - 8) }} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
      if (event.key === 'ArrowLeft' && branch) { event.preventDefault(); setBranch(null); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const buttons = [...panel.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
    }}>
      {branch && <button className="menu-back" onClick={() => setBranch(null)}>‹ {t(opened.name)} / {branch}</button>}
      {items.map(item => <button key={item.label} role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={item.checked} aria-haspopup={item.children ? 'menu' : undefined} disabled={item.disabled} className={item.separator ? 'menu-separator' : ''} onMouseDown={event => event.preventDefault()} onClick={() => { if (item.children) setBranch(item.label); else { close(); item.action?.(); } }}><span className="menu-check">{item.checked && <Check size={13} />}</span><span>{item.label}</span>{item.children ? <ChevronRight size={13} /> : <kbd>{item.shortcut}</kbd>}</button>)}
    </div>, document.body)}
  </>;
}
