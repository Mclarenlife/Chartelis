import { isTauri } from '@tauri-apps/api/core';
import { chatEndpoint, readAIKey, type AIProfile } from './ai-config';
import { t } from './i18n';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
const maxResponse = 1_000_000;
export class AIHttpError extends Error {
  constructor(public status: number) { super(`${t('API 请求失败')} (HTTP ${status})${status === 401 || status === 403 ? t('，请检查 API Key 和访问权限') : status === 429 ? t('，请检查额度或稍后重试') : status === 404 ? t('，请检查 API 地址和模型 ID') : ''}`); }
}
export async function readChatResponse(response: Response, onText: (text: string) => void): Promise<void> {
  if (!response.ok) { void response.body?.cancel(); throw new AIHttpError(response.status); }
  if (!response.body) throw new Error(t('API 没有返回内容'));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '', output = '', bytes = 0, done = false, truncated = false, finished = false;
  const streaming = response.headers.get('content-type')?.includes('text/event-stream');
  function payload(value: string, stream: boolean) {
    if (value.trim() === '[DONE]') { done = true; return; }
    let data;
    try { data = JSON.parse(value); } catch { throw new Error(t('API 返回了无效的数据格式')); }
    if (data.error) throw new Error(t('API 返回错误，请检查模型、额度和接口配置'));
    const choice = data.choices?.[0];
    if (choice?.finish_reason) finished = true;
    const content = stream ? choice?.delta?.content : choice?.message?.content;
    if (typeof content === 'string') { output += content; onText(output); }
    if (choice?.finish_reason === 'length') truncated = true;
    if (choice?.finish_reason === 'content_filter') throw new Error(t('回复被服务商过滤，请调整问题后重试'));
  }
  function events(final = false) {
    // SSE accepts CRLF, LF and standalone CR; avoid splitting a CRLF between chunks.
    pending = pending.replace(/\r\n/g, '\n').replace(/\r(?!$)/g, '\n');
    let index;
    while ((index = pending.indexOf('\n\n')) !== -1) {
      const block = pending.slice(0, index); pending = pending.slice(index + 2);
      const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
      if (data) payload(data, true);
      if (done) return;
    }
    if (final && pending.trim()) { pending += '\n\n'; events(); }
  }
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) { pending += decoder.decode(); break; }
      bytes += chunk.value.byteLength;
      if (bytes > maxResponse) throw new Error(t('回复过长，已停止接收，请缩小问题范围'));
      pending += decoder.decode(chunk.value, { stream: true });
      if (streaming) events();
    }
    if (streaming && !done) events(true);
    else if (!streaming) payload(pending, false);
    if (truncated) throw new Error(t('回复达到模型长度限制，已保留收到的内容'));
    if (!output.trim()) throw new Error(t('API 没有返回文字，请确认模型支持文字对话'));
    if (streaming && !done && !finished) throw new Error(t('连接提前结束，已保留收到的内容，请重试'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function requestChat(profile: AIProfile, messages: ChatTurn[], signal: AbortSignal, onText: (text: string) => void) {
  if (messages.reduce((sum, m) => sum + m.content.length, 0) > 200_000) throw new Error(t('对话过长，请新建对话后重试'));
  const key = await readAIKey(profile.id);
  signal.throwIfAborted();
  const options: RequestInit = {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: profile.model, messages, stream: true }), signal, redirect: 'error', credentials: 'omit',
  };
  const endpoint = chatEndpoint(profile.baseUrl);
  let response;
  try {
    response = isTauri() ? await (await import('@tauri-apps/plugin-http')).fetch(endpoint, { ...options, maxRedirections: 0, connectTimeout: 30_000 }) : await fetch(endpoint, options);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(t('连接失败，请检查地址和网络；浏览器预览还需接口允许跨域'));
  }
  await readChatResponse(response, onText);
}
