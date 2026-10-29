import { t } from './i18n';
import { writingThemes, inkOptions, writingColor } from './writing-preferences';
import { themes } from './preferences';
import LanguageSettings from './LanguageSettings';
import HighlightSettings from './HighlightSettings';
import MathCompatibilitySetting from './MathCompatibilitySetting';
import ToolbarSettings from './ToolbarSettings';
import type { FormatAction } from './formatting';
import FileAssociationSetting from './FileAssociationSetting';
import PluginSettings from './PluginSettings';
import type { PluginManager } from './usePlugins';
import { pluginThemeId } from './plugins';
interface Props {
  theme: string; setTheme(value: string): void; font: string; setFont(value: string): void;
  fontSize: number; setFontSize(value: number): void; outline: string; setOutline(value: string): void;
  contentWidth: number; setContentWidth(value: number): void;
  highlightColor: string; setHighlightColor(value: string): void;
  listStyle: string; setListStyle(value: string): void; toolbar: FormatAction[]; setToolbar(value: FormatAction[]): void;
  plugins: PluginManager;
  writingTheme: string; setWritingTheme(id: string): void; ink: string; setInk(id: string): void; dark: boolean;
}
export default function Settings(props: Props) {
  return <div className="settings-content">
    <LanguageSettings />
    <MathCompatibilitySetting />
    <section><h3>{t("外观")}</h3><div className="appearance-options" aria-label={t("标准外观")}>{[['light', t('亮色')], ['dark', t('暗色')], ['system', t('跟随系统')]].map(([id, label]) => <button key={id} className={props.theme === id ? 'selected' : ''} aria-pressed={props.theme === id} onClick={() => props.setTheme(id)}>{label}</button>)}</div><p className="settings-note">{t("跟随系统会随设备的亮色、暗色设置自动切换。")}</p></section>
    <section><h3>{t("其他配色")}<small>{t("可选")}</small></h3><div className="theme-grid">{themes.map(theme => <button key={theme.id} className={props.theme === theme.id ? 'selected' : ''} aria-pressed={props.theme === theme.id} onClick={() => props.setTheme(theme.id)}><span className="theme-swatch" style={{ background: theme.colors[0] }}><i style={{ background: theme.colors[1] }} /><i style={{ background: theme.colors[2] }} /></span>{t(theme.name)}</button>)}</div></section>
    <section className="writing-theme-settings"><h3>{t("排版主题")}</h3><p className="settings-note">{t("独立调整正文排版，不改变外观和界面配色。选定后可继续微调字体、字号与文字颜色。")}</p><div className="writing-theme-grid" aria-label={t("排版主题")}>{writingThemes.map(item => <button key={item.id} aria-pressed={props.writingTheme === item.id} onClick={() => props.setWritingTheme(item.id)}><span className={"theme-sample font-" + item.font} style={{ color: writingColor(item.ink, props.dark), fontSize: item.size }}>{t("留白之间")}<br /><small>{t("自在书写 Aa")}</small></span><strong>{t(item.name)}</strong><small>{t(item.description)}</small></button>)}</div></section>
    <FileAssociationSetting />
    {props.plugins.plugins.some(plugin => plugin.enabled && plugin.manifest.themes.length) && <section><h3>{t("插件主题")}</h3><div className="theme-grid">{props.plugins.plugins.filter(plugin => plugin.enabled).flatMap(({ manifest }) => manifest.themes.map(theme => {
      const id = pluginThemeId(manifest.id, theme.id);
      return <button key={id} title={manifest.name} className={props.theme === id ? 'selected' : ''} aria-pressed={props.theme === id} onClick={() => props.setTheme(id)}><span className="theme-swatch" style={{ background: theme.colors.paper }}><i style={{ background: theme.colors.accent }} /><i style={{ background: theme.colors.text }} /></span>{theme.name}</button>;
    }))}</div></section>}
    <PluginSettings manager={props.plugins} />
    <div className="setting-row"><span>{t("文稿列表")}</span><div className="segmented">{[['compact', t('简洁')], ['detailed', t('详细')]].map(([id, label]) => <button key={id} className={props.listStyle === id ? 'selected' : ''} onClick={() => props.setListStyle(id)}>{label}</button>)}</div></div>
    <div className="setting-row"><span>{t("大纲位置")}</span><div className="segmented">{[['left', t('左侧栏')], ['right', t('右侧栏')]].map(([id, label]) => <button key={id} className={props.outline === id ? 'selected' : ''} onClick={() => props.setOutline(id)}>{label}</button>)}</div></div>
    <div className="setting-row"><span>{t("正文字体")}</span><div className="segmented"><button className={props.font === 'serif' ? 'selected' : ''} onClick={() => props.setFont('serif')}>{t("人文宋体")}</button><button className={props.font === 'sans' ? 'selected' : ''} onClick={() => props.setFont('sans')}>{t("简洁黑体")}</button></div></div>
    <div className="setting-row"><label htmlFor="font-size">{t("文字大小")}</label><input id="font-size" type="range" min="13" max="28" value={props.fontSize} onChange={event => props.setFontSize(Number(event.target.value))} /><span>{props.fontSize}</span></div>
    <div className="setting-row"><label htmlFor="content-width">{t("正文最大宽度")}</label><input id="content-width" type="range" min="600" max="2000" step="20" value={props.contentWidth} onChange={event => props.setContentWidth(Number(event.target.value))} /><output htmlFor="content-width" className="content-width-value">{props.contentWidth} px</output></div>
    <p className="settings-note">{t("随窗口宽度自适应，达到设定上限后保持居中。")}</p>
    <div className="setting-row"><span>{t("正文颜色")}</span><div className="ink-options">{inkOptions.map(item => <button key={item.id} aria-label={t(item.name)} aria-pressed={props.ink === item.id} onClick={() => props.setInk(item.id)}><i style={{ background: writingColor(item.id, props.dark) }} />{t(item.name)}</button>)}</div></div>
    <HighlightSettings color={props.highlightColor} onChange={props.setHighlightColor} />
    <ToolbarSettings toolbar={props.toolbar} setToolbar={props.setToolbar} />
  </div>;
}
