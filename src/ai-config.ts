import { invoke, isTauri } from '@tauri-apps/api/core';
import { t } from './i18n';

export interface AIProfile { id: string; name: string; baseUrl: string; model: string }
export interface AISettings { profiles: AIProfile[]; activeId: string }
export const aiSettingsKey = 'chartelis.ai.settings.v1';
const secretKey = (id: string) => `chartelis.ai.session-key.${id}`;
export function chatEndpoint(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error(t('请输入有效的 API 地址')); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error(t('API 地址须使用 HTTPS，本机服务可使用 HTTP'));
  if (url.username || url.password || url.search || url.hash) throw new Error(t('API 地址不能包含账号、查询参数或锚点'));
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path || '/v1'}/chat/completions`;
  return url.href;
}
export function validateProfile(profile: AIProfile): AIProfile {
  if (!/^[a-f\d-]{36}$/i.test(profile.id)) throw new Error(t('API 配置无效'));
  if (!profile.name.trim() || !profile.model.trim()) throw new Error(t('请填写配置名称和模型 ID'));
  if (profile.name.length > 80 || profile.model.length > 200 || profile.baseUrl.length > 2000) throw new Error(t('API 配置内容过长'));
  chatEndpoint(profile.baseUrl);
  return { id: profile.id, name: profile.name.trim(), baseUrl: profile.baseUrl.trim(), model: profile.model.trim() };
}
export function loadAISettings(): AISettings {
  const raw = localStorage.getItem(aiSettingsKey);
  if (!raw) return { profiles: [], activeId: '' };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.profiles) || parsed.profiles.length > 30) throw new Error();
    const profiles: AIProfile[] = parsed.profiles.map(validateProfile);
    if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error();
    return { profiles, activeId: profiles.some(p => p.id === parsed.activeId) ? parsed.activeId : profiles[0]?.id || '' };
  } catch { throw new Error(t('无法读取 AI 配置，请检查本地存储')); }
}
export function saveAISettings(value: AISettings) {
  // Explicit fields only: credentials must never be serialized with settings.
  localStorage.setItem(aiSettingsKey, JSON.stringify({ profiles: value.profiles.map(validateProfile), activeId: value.activeId }));
}
export async function readAIKey(id: string): Promise<string> {
  try { return isTauri() ? await invoke<string | null>('ai_get_key', { id }) || '' : sessionStorage.getItem(secretKey(id)) || ''; }
  catch { throw new Error(t('无法读取 API Key，请检查系统凭据库')); }
}
export async function writeAIKey(id: string, key: string) {
  if (key.length > 4096 || /[^\x21-\x7e]/.test(key)) throw new Error(t('API Key 格式无效'));
  try {
    if (isTauri()) await invoke(key ? 'ai_set_key' : 'ai_delete_key', key ? { id, key } : { id });
    else if (key) sessionStorage.setItem(secretKey(id), key);
    else sessionStorage.removeItem(secretKey(id));
  } catch { throw new Error(t('无法保存 API Key，请检查系统凭据库')); }
}
