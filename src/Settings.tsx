import { themes } from './preferences';
import ToolbarSettings from './ToolbarSettings';
import type { FormatAction } from './formatting';
import FileAssociationSetting from './FileAssociationSetting';
interface Props {
  theme: string; setTheme(value: string): void; font: string; setFont(value: string): void;
  fontSize: number; setFontSize(value: number): void; outline: string; setOutline(value: string): void;
  listStyle: string; setListStyle(value: string): void; toolbar: FormatAction[]; setToolbar(value: FormatAction[]): void;
}
export default function Settings(props: Props) {
  return <div className="settings-content">
    <section><h3>外观</h3><div className="appearance-options" aria-label="标准外观">{[['light', '亮色'], ['dark', '暗色'], ['system', '跟随系统']].map(([id, label]) => <button key={id} className={props.theme === id ? 'selected' : ''} aria-pressed={props.theme === id} onClick={() => props.setTheme(id)}>{label}</button>)}</div><p className="settings-note">跟随系统会随设备的亮色、暗色设置自动切换。</p></section>
    <section><h3>其他配色 <small>可选</small></h3><div className="theme-grid">{themes.map(theme => <button key={theme.id} className={props.theme === theme.id ? 'selected' : ''} aria-pressed={props.theme === theme.id} onClick={() => props.setTheme(theme.id)}><span className="theme-swatch" style={{ background: theme.colors[0] }}><i style={{ background: theme.colors[1] }} /><i style={{ background: theme.colors[2] }} /></span>{theme.name}</button>)}</div></section>
    <FileAssociationSetting />
    <div className="setting-row"><span>文稿列表</span><div className="segmented">{[['compact', '简洁'], ['detailed', '详细']].map(([id, label]) => <button key={id} className={props.listStyle === id ? 'selected' : ''} onClick={() => props.setListStyle(id)}>{label}</button>)}</div></div>
    <div className="setting-row"><span>大纲位置</span><div className="segmented">{[['left', '左侧栏'], ['right', '右侧栏']].map(([id, label]) => <button key={id} className={props.outline === id ? 'selected' : ''} onClick={() => props.setOutline(id)}>{label}</button>)}</div></div>
    <div className="setting-row"><span>正文字体</span><div className="segmented"><button className={props.font === 'serif' ? 'selected' : ''} onClick={() => props.setFont('serif')}>人文宋体</button><button className={props.font === 'sans' ? 'selected' : ''} onClick={() => props.setFont('sans')}>简洁黑体</button></div></div>
    <div className="setting-row"><label htmlFor="font-size">文字大小</label><input id="font-size" type="range" min="13" max="28" value={props.fontSize} onChange={event => props.setFontSize(Number(event.target.value))} /><span>{props.fontSize}</span></div>
    <ToolbarSettings toolbar={props.toolbar} setToolbar={props.setToolbar} />
  </div>;
}
