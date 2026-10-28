import { useEffect, useRef } from 'react';
import { t, useLanguage } from './i18n';
import LanguageSettings from './LanguageSettings';
export default function LanguageWelcome({ onDone }: { onDone(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { language, setLanguage } = useLanguage();
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const done = () => { setLanguage(language); onDone(); };
  return <dialog ref={dialog} className="modal language-welcome" aria-label="Language / 语言" onCancel={event => { event.preventDefault(); done(); }}>
    <h2>Chartelis</h2><p>{t('选择你的语言')}</p><LanguageSettings /><div className="modal-actions"><button className="primary-button" onClick={done}>{t('开始使用')}</button></div>
  </dialog>;
}
