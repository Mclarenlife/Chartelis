import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { t, tf } from './i18n';

// Only mounted in the Windows desktop app. close() follows the same close-request
// path as Alt+F4, including the workspace persistence and unsaved-work guard.
export default function WindowControls({ onError }: { onError(message: string, error: boolean): void }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const refresh = async () => {
      try { const next = await win.isMaximized(); if (!disposed) setMaximized(next); }
      catch (error) { if (!disposed) onError(tf`窗口操作失败：${String(error)}`, true); }
    };
    void refresh();
    void win.onResized(() => void refresh()).then(stop => { if (disposed) stop(); else unlisten = stop; })
      .catch(error => { if (!disposed) onError(tf`窗口操作失败：${String(error)}`, true); });
    return () => { disposed = true; unlisten?.(); };
  }, [onError]);
  const run = async (action: 'minimize' | 'toggleMaximize' | 'close') => {
    try { await getCurrentWindow()[action](); }
    catch (error) { onError(tf`窗口操作失败：${String(error)}`, true); }
  };
  return <div className="window-controls" role="group" aria-label={t('窗口控制')}>
    <button aria-label={t('最小化窗口')} title={t('最小化窗口')} onClick={() => void run('minimize')}><Minus size={15} /></button>
    <button aria-label={maximized ? t('还原窗口') : t('最大化窗口')} title={maximized ? t('还原窗口') : t('最大化窗口')} onClick={() => void run('toggleMaximize')}>{maximized ? <Copy size={13} /> : <Square size={13} />}</button>
    <button className="window-close" aria-label={t('关闭窗口')} title={t('关闭窗口')} onClick={() => void run('close')}><X size={17} /></button>
  </div>;
}
