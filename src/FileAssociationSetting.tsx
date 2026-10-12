import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { desktop } from './files';

export default function FileAssociationSetting() {
  const mac = navigator.platform.toLowerCase().includes('mac');
  const [status, setStatus] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!desktop) return;
    const refresh = () => void invoke<boolean>('is_default_markdown_app').then(setStatus).catch(() => {});
    refresh(); window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  async function configure() {
    setPending(true); setMessage('');
    try {
      const result = await invoke<string>('configure_markdown_default');
      setMessage(result); setStatus(await invoke<boolean>('is_default_markdown_app'));
    } catch (error) { setMessage(`设置失败：${String(error)}`); }
    finally { setPending(false); }
  }
  return <section className="file-association-setting"><h3>默认打开方式</h3><div className="setting-row"><span>Markdown 文件（.md）<small>{status ? 'Chartelis 已是默认应用' : '使用 Chartelis 打开 Markdown 文件'}</small></span><button className="secondary-button" disabled={!desktop || pending} onClick={() => void configure()}>{pending ? '处理中…' : mac ? '设为默认应用' : '设置默认应用'}</button></div><p className="settings-note">{!desktop ? '请在安装后的桌面版中设置。' : mac ? '请先将 Chartelis 拖入“应用程序”文件夹，再设置默认应用。' : '将打开 Windows 默认应用设置；找到 .md，选择 Chartelis。'}</p>{message && <p className="settings-note" role="status">{message}</p>}</section>;
}
