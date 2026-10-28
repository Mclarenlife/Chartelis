import { useState } from 'react';
import { setLatexCompatibility, useLatexCompatibility } from './latex-preference';
import { t } from './i18n';

export default function MathCompatibilitySetting() {
  const enabled = useLatexCompatibility();
  const [error, setError] = useState(false);
  return <section className="math-compatibility-setting">
    <h3>{t('公式兼容')}</h3>
    <label className="setting-row"><span>{t('兼容 LaTeX 公式分隔符')}</span><input type="checkbox" role="switch" checked={enabled} onChange={event => {
      try { setLatexCompatibility(event.target.checked); setError(false); } catch { setError(true); }
    }} /></label>
    <p className="settings-note">{t('识别 AI 常用的行内公式')} <code>{'\\(…\\)'}</code> {t('和独立公式')} <code>{'\\[…\\]'}</code>{t('。适用于正文预览、AI 回复及导出；关闭时显示源码，切换不会修改文稿。')}</p>
    <p className="settings-note">{t('标准的 $…$ 与 $$…$$ 始终可用，代码中的示例保持原样。')}</p>
    {error && <p className="settings-note" role="alert">{t('无法保存设置，请检查本地存储')}</p>}
  </section>;
}
