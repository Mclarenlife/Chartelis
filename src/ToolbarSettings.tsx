import { useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import FormatToolbar, { FormatIcon, formatLabel } from './FormatToolbar';
import { defaultToolbar, toolbarOptions } from './preferences';
import type { FormatAction } from './formatting';

export default function ToolbarSettings({ toolbar, setToolbar }: { toolbar: FormatAction[]; setToolbar(value: FormatAction[]): void }) {
  const [selected, setSelected] = useState<FormatAction>();
  const current = selected && toolbar.includes(selected) ? selected : toolbar[0];
  const index = current ? toolbar.indexOf(current) : -1;
  const move = (offset: number) => {
    if (index < 0 || index + offset < 0 || index + offset >= toolbar.length) return;
    const next = [...toolbar];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setSelected(current); setToolbar(next);
  };
  return <section className="toolbar-settings">
    <h3>选区浮动工具栏 <button onClick={() => { setToolbar(defaultToolbar); setSelected(defaultToolbar[0]); }}>恢复默认</button></h3>
    <p>点击预览中的图标调整顺序，下方选择要显示的工具。修改即时生效。</p>
    <div className="toolbar-preview-stage">
      {toolbar.length ? <FormatToolbar actions={toolbar} selected={current} onSelect={setSelected} preview /> : <span className="toolbar-empty" role="status">工具栏已隐藏，选择下方图标即可添加</span>}
      <span className="toolbar-preview-selection">选中一段文字，让想法自然发生。</span>
    </div>
    <div className="toolbar-adjustments">
      <span>{current ? formatLabel(current) : '未选择工具'}</span>
      <button aria-label="向左移动所选工具" title="向左移动" disabled={index <= 0} onClick={() => move(-1)}><ArrowLeft size={15} /></button>
      <button aria-label="向右移动所选工具" title="向右移动" disabled={index < 0 || index >= toolbar.length - 1} onClick={() => move(1)}><ArrowRight size={15} /></button>
      <button aria-label="移除所选工具" title="从工具栏移除" disabled={!current} onClick={() => setToolbar(toolbar.filter(id => id !== current))}><X size={15} /></button>
    </div>
    <div className="toolbar-palette" role="group" aria-label="可选工具">{toolbarOptions.map(([id, label]) => <button key={id} aria-label={label} title={label} aria-pressed={toolbar.includes(id)} onClick={() => {
      if (toolbar.includes(id)) setToolbar(toolbar.filter(value => value !== id));
      else { setToolbar([...toolbar, id]); setSelected(id); }
    }}><FormatIcon action={id} /><span className="toolbar-palette-dot" /></button>)}</div>
  </section>;
}
