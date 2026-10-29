import { t } from './i18n';
import { defaultHighlightColor } from './preferences';

const colors = [['黄色', defaultHighlightColor], ['绿色', '#a7d7af'], ['蓝色', '#a6c9ee'], ['橙色', '#edbf91'], ['红色', '#e9a2a2'], ['粉红色', '#e8b0ce'], ['紫色', '#c6afe5']];
export default function HighlightSettings({ color, onChange }: { color: string; onChange(color: string): void }) {
  return <section className="highlight-settings">
    <h3>{t('高亮颜色')}</h3>
    <p className="settings-note">{t('调整 ==高亮文字== 的背景颜色，不修改 Markdown 原文。')}</p>
    <div className="highlight-color-options" role="group" aria-label={t('高亮颜色')}>
      {colors.map(([name, value]) => <button key={value} title={t(name)} aria-label={t(name)} aria-pressed={color === value} style={{ background: value }} onClick={() => onChange(value)} />)}
      <label className="highlight-custom">{t('自定义颜色')}<input type="color" aria-label={t('自定义高亮颜色')} value={color} onChange={event => onChange(event.target.value)} /></label>
      <button className="text-button" onClick={() => onChange(defaultHighlightColor)}>{t('恢复默认')}</button>
    </div>
    <div className="highlight-sample"><mark>{t('高亮效果预览')}</mark></div>
  </section>;
}
