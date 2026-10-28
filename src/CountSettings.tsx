import { t } from './i18n';
import { countLabels, countText, type CountOptions } from './writing-preferences';
export default function CountSettings({ options, onChange, markdown }: { options: CountOptions; onChange(value: CountOptions): void; markdown: string }) {
  return <div className="count-settings">
    <div className="count-preview"><strong>{countText(markdown, options).toLocaleString()}</strong><span>{t(countLabels[options.mode])}</span></div>
    <div className="setting-row"><span>{t("统计方式")}</span><select aria-label={t("统计方式")} value={options.mode} onChange={event => onChange({ ...options, mode: event.target.value as CountOptions['mode'] })}><option value="characters">{t("字符数")}</option><option value="words">{t("中英文字词数")}</option><option value="han">{t("仅汉字")}</option></select></div>
    <label className="count-option"><input type="checkbox" checked={options.source} onChange={event => onChange({ ...options, source: event.target.checked })} />{t("统计 Markdown 源码")}</label>
    <label className="count-option"><input type="checkbox" disabled={options.source} checked={options.code} onChange={event => onChange({ ...options, code: event.target.checked })} />{t("包含代码与公式内容")}</label>
    <label className="count-option"><input type="checkbox" disabled={options.mode !== 'characters'} checked={options.spaces} onChange={event => onChange({ ...options, spaces: event.target.checked })} />{t("包含空格和换行")}</label>
    <label className="count-option"><input type="checkbox" disabled={options.mode !== 'characters'} checked={options.punctuation} onChange={event => onChange({ ...options, punctuation: event.target.checked })} />{t("包含标点与符号")}</label>
    <p className="settings-note">{t("正文统计不计 Markdown 标记和链接地址。中英文字词数按每个汉字一字、连续英文或数字一词计算。公式按 LaTeX 内容统计；设置会自动保存。")}</p>
  </div>;
}
