import { t, tf } from './i18n';
import { useRef, useState } from 'react';
import { Puzzle, Upload, Trash2 } from 'lucide-react';
import { maxPluginBytes, parsePlugin, pluginStorageKey, type PluginManifest } from './plugins';
import type { PluginManager } from './usePlugins';
import starter from '../examples/plugins/writing-kit.chartelis-plugin.json';

export default function PluginSettings({ manager }: { manager: PluginManager }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PluginManifest | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [importing, setImporting] = useState(false);
  function attempt(action: () => void, success: string) {
    try { action(); setFailed(false); setMessage(success); }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : t('操作失败')); }
  }
  async function read(file?: File) {
    if (!file) return;
    setPending(null); setImporting(true);
    try {
      if (file.size > maxPluginBytes) throw new Error(t('插件包不能超过 256 KB'));
      const manifest = parsePlugin(await file.text());
      setPending(manifest); setMessage('');
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : t('导入失败')); }
    finally { setImporting(false); if (input.current) input.current.value = ''; }
  }
  function backup() {
    const raw = localStorage.getItem(pluginStorageKey);
    if (raw === null) throw new Error(t('没有可导出的插件记录'));
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'chartelis-plugins-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const existing = manager.plugins.find(item => item.manifest.id === pending?.id);
  return <section className="plugin-settings" aria-label={t("插件管理")}>
    <h3><Puzzle size={17} /> {t("插件管理")}<small>{manager.plugins.length} {t("个已安装")}</small></h3>
    <p className="settings-note">{t("主题在外观中选择，模板位于「文件」，选区命令位于「编辑」。插件仅在本机保存。")}</p>
    {manager.error ? <div className="plugin-review" role="alert"><p>{manager.error}</p><button onClick={() => attempt(backup, t('备份已下载'))}>{t("导出原始记录")}</button><button onClick={() => setRemoveId('__reset')}>{t("重置插件记录")}</button></div> : <div className="plugin-actions">
      <button disabled={importing} onClick={() => input.current?.click()}><Upload size={14} />{importing ? t('读取中…') : t('导入插件包')}</button>
      <button disabled={importing} onClick={() => attempt(() => setPending(parsePlugin(JSON.stringify(starter))), '')}>{t("查看示例插件")}</button>
      <input ref={input} type="file" accept=".json,application/json" aria-label={t("选择插件包")} hidden onChange={event => void read(event.target.files?.[0])} />
    </div>}
    {pending && <div className="plugin-review" aria-label={t("插件安装预览")}>
      <strong>{pending.name} <small>v{pending.version}</small></strong><p>{pending.description}</p>
      <small>{pending.author} · {pending.id}</small>
      <p>{pending.themes.length} {t("个主题 ·")}{pending.templates.length} {t("个模板 ·")}{pending.commands.length} {t("个选区命令")}</p>
      <ul>{pending.themes.map(item => <li key={`t${item.id}`}>{t("主题：")}{item.name}</li>)}{pending.templates.map(item => <li key={`d${item.id}`}>{t("模板：")}{item.name}</li>)}{pending.commands.map(item => <li key={`c${item.id}`}>{t("命令：")}{item.name}</li>)}</ul>
      <p className="settings-note">{t("主题可调整界面颜色；模板仅新建草稿；命令只在手动执行时处理选中文字。插件不运行脚本，模板按普通 Markdown 文稿显示。")}</p>
      {existing && <p>{t("将替换已安装的 v")}{existing.manifest.version}{t("，保留启停状态。")}</p>}
      <div className="plugin-actions"><button onClick={() => attempt(() => { manager.install(pending); setPending(null); }, t('插件已保存'))}>{existing ? t('替换此插件') : t('安装插件')}</button><button onClick={() => setPending(null)}>{t("取消")}</button></div>
    </div>}
    {!manager.plugins.length && !manager.error && !pending && <p className="plugin-empty">{t("尚未安装插件。可以先试试「写作工具箱」示例。")}</p>}
    {manager.plugins.map(({ manifest, enabled }) => <article className="plugin-card" key={manifest.id}>
      <div><strong>{manifest.name}</strong><small>v{manifest.version} · {manifest.author}</small><p>{manifest.description}</p><small>{manifest.themes.length} {t("个主题 ·")}{manifest.templates.length} {t("个模板 ·")}{manifest.commands.length} {t("个命令")}</small></div>
      <div className="plugin-card-actions"><button role="switch" aria-checked={enabled} aria-label={tf`启用 ${manifest.name}`} onClick={() => attempt(() => manager.toggle(manifest.id), enabled ? t('插件已停用') : t('插件已启用'))}>{enabled ? t('已启用') : t('已停用')}</button><button className="icon-button" aria-label={tf`卸载 ${manifest.name}`} title={t("卸载")} onClick={() => setRemoveId(manifest.id)}><Trash2 size={15} /></button></div>
      {removeId === manifest.id && <div className="plugin-confirm"><span>{t("卸载插件？已创建的文稿会保留。")}</span><button onClick={() => attempt(() => { manager.remove(manifest.id); setRemoveId(null); }, t('插件已卸载'))}>{t("确认卸载")}</button><button onClick={() => setRemoveId(null)}>{t("取消")}</button></div>}
    </article>)}
    {removeId === '__reset' && <div className="plugin-confirm"><span>{t("清空插件记录？此操作无法撤销。")}</span><button onClick={() => attempt(() => { manager.reset(); setRemoveId(null); }, t('插件记录已重置'))}>{t("确认重置")}</button><button onClick={() => setRemoveId(null)}>{t("取消")}</button></div>}
    {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'plugin-error' : 'settings-note'}>{message}</p>}
  </section>;
}
