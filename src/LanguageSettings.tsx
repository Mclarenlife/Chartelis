import { t, useLanguage, type Language } from './i18n';
export default function LanguageSettings() {
  const { language, setLanguage } = useLanguage();
  return <section className="language-setting"><h3>{t('语言')}</h3><select aria-label={t('界面语言')} value={language} onChange={event => setLanguage(event.target.value as Language)}>
    <option value="system">{t('跟随系统')}</option><option value="zh-CN">简体中文</option><option value="en">English</option>
  </select><p className="settings-note">{t('修改立即生效，不会改变文稿内容。系统文件对话框继续使用系统语言。')}</p></section>;
}
