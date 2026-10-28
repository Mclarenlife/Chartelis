import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUp, Check, Copy, MessageSquarePlus, Plus, Settings2, Sparkles, Square, Trash2, X, ChevronLeft, Quote } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { loadAISettings, saveAISettings, validateProfile, readAIKey, writeAIKey, type AIProfile, type AISettings } from './ai-config';
import { requestChat, type ChatTurn } from './ai-client';
import { renderAIMarkdown } from './ai-markdown';
import { writeClipboard } from './clipboard';
import { t, useLanguage } from './i18n';
import './ai.css';
import { useLatexCompatibility } from './latex-preference';

interface Message extends ChatTurn { id: string; state: 'complete' | 'pending' | 'error' | 'stopped'; error?: string }
type Conversation = { messages: Message[]; draft: string; quote: string };
const emptyConversation = (): Conversation => ({ messages: [], draft: '', quote: '' });
function Markdown({ text }: { text: string }) {
  const compatible = useLatexCompatibility();
  const deferred = useDeferredValue(text);
  const html = useMemo(() => renderAIMarkdown(deferred), [deferred, compatible]);
  return <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function AIAssistant({ open, onClose, selection }: { open: boolean; onClose(): void; selection(): string }) {
  useLanguage();
  const [initial] = useState(() => { try { return { settings: loadAISettings(), error: '' }; } catch (error) { return { settings: { profiles: [], activeId: '' } as AISettings, error: (error as Error).message }; } });
  const [settings, setSettings] = useState(initial.settings);
  const [manage, setManage] = useState(!initial.settings.profiles.length);
  const [form, setForm] = useState<AIProfile | null>(null);
  const [key, setKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [error, setError] = useState(initial.error);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [running, setRunning] = useState(false);
  const request = useRef<AbortController | null>(null);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [copied, setCopied] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const active = settings.profiles.find(profile => profile.id === settings.activeId);
  const conversation = conversations[settings.activeId] || emptyConversation();
  function update(id: string, fn: (value: Conversation) => Conversation) {
    setConversations(all => ({ ...all, [id]: fn(all[id] || emptyConversation()) }));
  }
  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => { if (!open) request.current?.abort(); }, [open]);
  useEffect(() => {
    if (open && !manage && stickToBottom.current) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, manage, conversation.messages]);
  function commit(next: AISettings) { saveAISettings(next); setSettings(next); }
  function edit(profile?: AIProfile) {
    setForm(profile ? { ...profile } : { id: crypto.randomUUID(), name: '', baseUrl: '', model: '' });
    setKey(''); setClearKey(false); setError(''); setDeleteId('');
  }
  async function save() {
    if (!form || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    let previousKey: string | undefined;
    let changedKey = false;
    try {
      const profile = validateProfile(form);
      const existing = settings.profiles.some(p => p.id === profile.id);
      if (!existing && settings.profiles.length >= 30) throw new Error(t('最多保存 30 组 API 配置'));
      if (key.trim() || clearKey) {
        previousKey = await readAIKey(profile.id);
        await writeAIKey(profile.id, clearKey ? '' : key.trim()); changedKey = true;
      }
      commit({ profiles: existing ? settings.profiles.map(p => p.id === profile.id ? profile : p) : [...settings.profiles, profile], activeId: settings.activeId || profile.id });
      setForm(null); setKey(''); setClearKey(false);
    } catch (error) {
      if (changedKey && previousKey !== undefined) await writeAIKey(form.id, previousKey).catch(() => {});
      setError(error instanceof Error ? error.message : t('无法保存 API 配置'));
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function remove(id: string) {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try {
      await writeAIKey(id, '');
      const profiles = settings.profiles.filter(p => p.id !== id);
      commit({ profiles, activeId: settings.activeId === id ? profiles[0]?.id || '' : settings.activeId });
      setConversations(all => { const next = { ...all }; delete next[id]; return next; }); setDeleteId('');
    } catch { setError(t('删除失败，请检查本地存储或系统凭据库')); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function send(retry = false) {
    if (!active || request.current || savingRef.current) return;
    const prompt = conversation.draft.trim();
    if (!retry && !prompt) return;
    const base = retry ? conversation.messages.slice(0, -1) : [...conversation.messages, {
      id: crypto.randomUUID(), role: 'user' as const, state: 'complete' as const,
      content: `${prompt}${conversation.quote ? `\n\n${t('引用文字')}\n\n${conversation.quote}` : ''}`,
    }];
    if (!base.length || base.at(-1)?.role !== 'user') return;
    const responseId = crypto.randomUUID(), id = active.id;
    const controller = new AbortController(); request.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 180_000);
    setRunning(true); setError(''); stickToBottom.current = true;
    update(id, value => ({ ...value, draft: retry ? value.draft : '', quote: retry ? value.quote : '', messages: [...base, { id: responseId, role: 'assistant', content: '', state: 'pending' }] }));
    const patch = (change: Partial<Message>) => update(id, value => ({ ...value, messages: value.messages.map(message => message.id === responseId ? { ...message, ...change } : message) }));
    try {
      await requestChat(active, base.filter(m => m.state === 'complete').map(({ role, content }) => ({ role, content })), controller.signal, content => {
        if (!controller.signal.aborted) patch({ content });
      });
      patch({ state: controller.signal.aborted ? 'stopped' : 'complete' });
    } catch (error) {
      patch({ state: controller.signal.aborted && !timedOut ? 'stopped' : 'error', error: timedOut ? t('请求超时，已保留收到的内容') : controller.signal.aborted ? undefined : error instanceof Error ? error.message : t('AI 请求失败，请稍后重试') });
    } finally { clearTimeout(timeout); request.current = null; setRunning(false); }
  }
  const close = () => { request.current?.abort(); onClose(); };
  return <motion.aside id="ai-assistant" className="ai-panel" aria-label={t('AI 助手')} hidden={!open}
    initial={false} animate={{ opacity: open ? 1 : 0, x: open ? 0 : 12 }} transition={{ duration: .18 }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <div className="ai-heading"><span><Sparkles size={17} />{t('AI 助手')}</span><div>
      <button className="icon-button" aria-label={t('新建对话')} title={t('新建对话')} disabled={running || !conversation.messages.length} onClick={() => { if (active) update(active.id, () => emptyConversation()); }}><MessageSquarePlus size={17} /></button>
      <button className={`icon-button ${manage ? 'is-active' : ''}`} aria-label={t('管理 API')} title={t('管理 API')} disabled={running} onClick={() => { setManage(!manage); setForm(null); setKey(''); setError(''); }}><Settings2 size={16} /></button>
      <button className="icon-button" aria-label={t('关闭 AI 助手')} onClick={close}><X size={17} /></button>
    </div></div>
    <div className="ai-profile-picker"><select aria-label={t('当前 API')} disabled={running || saving || !settings.profiles.length} value={settings.activeId} onChange={event => {
      try { commit({ ...settings, activeId: event.target.value }); setError(''); stickToBottom.current = true; } catch { setError(t('无法保存 API 配置')); }
    }}>
      {!settings.profiles.length && <option value="">{t('先添加 API 配置')}</option>}
      {settings.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name} · {profile.model}</option>)}
    </select><span className="ai-protocol">Chat Completions</span></div>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {manage ? <div className="ai-manage">
      {form ? <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <button type="button" className="ai-back" disabled={saving} onClick={() => { setForm(null); setKey(''); setError(''); }}><ChevronLeft size={14} />{t('返回配置列表')}</button>
        <h3>{settings.profiles.some(p => p.id === form.id) ? t('编辑 API') : t('添加 API')}</h3>
        <label>{t('配置名称')}<input autoFocus required maxLength={80} value={form.name} placeholder={t('例如：日常写作')} onChange={e => setForm({ ...form, name: e.target.value })} disabled={saving} /></label>
        <label>{t('API 地址')}<input required type="url" value={form.baseUrl} placeholder="https://api.example.com/v1" onChange={e => setForm({ ...form, baseUrl: e.target.value })} disabled={saving} spellCheck={false} /></label>
        <p className="ai-note">{t('支持基础地址或完整的 /chat/completions 地址。')}</p>
        <label>{t('模型 ID')}<input required maxLength={200} value={form.model} placeholder={t('填写服务商提供的模型 ID')} onChange={e => setForm({ ...form, model: e.target.value })} disabled={saving} spellCheck={false} /></label>
        <label>API Key<input type="password" value={key} autoComplete="off" spellCheck={false} maxLength={4096} placeholder={settings.profiles.some(p => p.id === form.id) ? t('留空保留现有密钥') : t('本机免密服务可留空')} onChange={e => { setKey(e.target.value); setClearKey(false); }} disabled={saving} /></label>
        {settings.profiles.some(p => p.id === form.id) && <label className="ai-checkbox"><input type="checkbox" checked={clearKey} onChange={e => { setClearKey(e.target.checked); if (e.target.checked) setKey(''); }} disabled={saving} />{t('移除已保存的密钥')}</label>}
        <p className="ai-note">{isTauri() ? t('API Key 保存在系统凭据库，配置保存在本机。') : t('浏览器预览：配置保存在本机，密钥仅保留在当前标签页会话。桌面版使用系统凭据库。')}</p>
        <button className="primary-button ai-save" disabled={saving || !!initial.error} type="submit">{saving ? t('保存中…') : t('保存配置')}</button>
      </form> : <>
        <div className="ai-manage-title"><h3>{t('我的 API')}</h3><button className="ai-add" disabled={saving || settings.profiles.length >= 30 || !!initial.error} onClick={() => edit()}><Plus size={14} />{t('添加 API')}</button></div>
        <p className="ai-note">{t('支持兼容 OpenAI 的 Chat Completions 接口。不同 API 的对话分别保留，切换时不会自动转发。')}</p>
        <div className="ai-profiles">{settings.profiles.map(profile => <article key={profile.id} className={profile.id === settings.activeId ? 'selected' : ''}>
          <button className="ai-profile-info" disabled={saving} onClick={() => edit(profile)}><strong>{profile.name}{profile.id === settings.activeId && <Check size={13} />}</strong><span>{profile.model}</span><small>{new URL(profile.baseUrl).host}</small></button>
          <button className="icon-button" aria-label={`${t('删除 API')} ${profile.name}`} disabled={saving} onClick={() => setDeleteId(profile.id)}><Trash2 size={15} /></button>
          {deleteId === profile.id && <div className="ai-delete-confirm"><p>{t('删除此配置及密钥？此 API 的当前对话也会清空。')}</p><button disabled={saving} onClick={() => void remove(profile.id)}>{t('确认删除')}</button><button disabled={saving} onClick={() => setDeleteId('')}>{t('取消')}</button></div>}
        </article>)}</div>
        {!settings.profiles.length && <div className="ai-empty"><Sparkles size={28} /><h3>{t('连接你的写作助手')}</h3><p>{t('添加 API 地址、密钥和模型，即可开始对话。')}</p></div>}
        {active && <button className="primary-button ai-save" onClick={() => setManage(false)}>{t('开始对话')}</button>}
      </>}
    </div> : <>
      <div className="ai-messages" ref={list} onScroll={() => { const el = list.current!; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {!conversation.messages.length && <div className="ai-empty"><Sparkles size={28} /><h3>{t('让灵感继续')}</h3><p>{t('讨论想法、润色文字，或一起梳理文章。文稿不会自动发送。')}</p><div className="ai-suggestions">{['帮我梳理写作提纲', '帮我润色一段文字', '解释 Markdown 语法'].map(prompt => <button key={prompt} disabled={!active} onClick={() => { if (active) update(active.id, value => ({ ...value, draft: t(prompt) })); input.current?.focus(); }}>{t(prompt)}</button>)}</div></div>}
        {conversation.messages.map((message, index) => <article className={`ai-message ${message.role}`} key={message.id}>
          <div className="ai-message-label">{message.role === 'user' ? t('你') : active?.name}<span>{message.state === 'pending' ? t('生成中…') : message.state === 'stopped' ? t('已停止') : ''}</span></div>
          {message.role === 'assistant' ? <Markdown text={message.content} /> : <div className="ai-user-text">{message.content}</div>}
          {message.state === 'pending' && !message.content && <div className="ai-thinking" role="status">{t('正在思考…')}</div>}
          {message.error && <p className="ai-error" role="alert">{message.error}</p>}
          {message.role === 'assistant' && message.state !== 'pending' && <div className="ai-message-actions">
            {message.content && <button aria-label={t('复制回复')} onClick={() => void writeClipboard(message.content).then(() => setCopied(message.id)).catch(() => setError(t('复制失败，请重试')))}>{copied === message.id ? <Check size={13} /> : <Copy size={13} />}{copied === message.id ? t('已复制') : t('复制')}</button>}
            {index === conversation.messages.length - 1 && ['error', 'stopped'].includes(message.state) && <button disabled={running} onClick={() => void send(true)}>{t('重新生成')}</button>}
          </div>}
        </article>)}
      </div>
      <div className="ai-composer">
        {conversation.quote && <div className="ai-quote"><Quote size={13} /><span>{conversation.quote}</span><button className="icon-button" aria-label={t('移除引用')} onClick={() => active && update(active.id, value => ({ ...value, quote: '' }))}><X size={13} /></button></div>}
        <textarea ref={input} aria-label={t('发送给 AI 的消息')} placeholder={t('写下问题，Enter 发送…')} value={conversation.draft} maxLength={30000} disabled={!active} rows={3}
          onChange={event => active && update(active.id, value => ({ ...value, draft: event.target.value }))}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
        <div className="ai-composer-actions"><button className="ai-attach" disabled={!active || running} onMouseDown={e => e.preventDefault()} onClick={() => { const text = selection(); if (!text) { setError(t('请先在文稿中选中文字')); return; } if (text.length > 30000) { setError(t('选区过长，请选择更短的内容')); return; } if (active) update(active.id, value => ({ ...value, quote: text })); setError(''); input.current?.focus(); }}><Quote size={14} />{t('引用选区')}</button><small>Shift + Enter</small>
          {running ? <button className="ai-send" aria-label={t('停止生成')} onClick={() => request.current?.abort()}><Square size={15} /></button> : <button className="ai-send" aria-label={t('发送消息')} disabled={!active || !conversation.draft.trim()} onClick={() => void send()}><ArrowUp size={18} /></button>}
        </div>
        <p className="ai-note ai-send-note">{t('发送到所选 API；对话仅保留在本次运行中。')}</p>
      </div>
    </>}
  </motion.aside>;
}
