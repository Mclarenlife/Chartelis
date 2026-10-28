import { useSyncExternalStore } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import english from './locales/en.json';

export type Language = 'system' | 'zh-CN' | 'en';
const key = 'chartelis.language';
const listeners = new Set<() => void>();
let preference: Language = 'system';
let resolved: 'zh-CN' | 'en' = 'zh-CN';
export let needsLanguageChoice = false;
export function resolveLanguage(value: Language, languages = navigator.languages): 'zh-CN' | 'en' {
  if (value !== 'system') return value;
  for (const language of languages) {
    if (/^zh\b/i.test(language)) return 'zh-CN';
    if (/^en\b/i.test(language)) return 'en';
  }
  return 'en';
}
function valid(value: unknown): value is Language { return value === 'system' || value === 'zh-CN' || value === 'en'; }
function update() {
  resolved = resolveLanguage(preference);
  document.documentElement.lang = resolved;
  listeners.forEach(listener => listener());
}
export async function initializeLanguage() {
  needsLanguageChoice = false;
  let saved: string | null = null;
  try { saved = localStorage.getItem(key); } catch { /* Storage may be unavailable. */ }
  if (valid(saved)) preference = saved;
  else {
    let installed: unknown;
    if (isTauri()) { try { installed = await invoke('installation_language'); } catch { /* Portable/browser fallback. */ } }
    preference = valid(installed) ? installed : 'system';
    needsLanguageChoice = isTauri() && !valid(installed);
    if (valid(installed)) { try { localStorage.setItem(key, preference); } catch { /* Keep in-memory preference. */ } }
  }
  update();
}
export function setLanguage(value: Language) {
  preference = value; needsLanguageChoice = false;
  try { localStorage.setItem(key, value); } catch { /* The current session can still switch. */ }
  update();
}
if (typeof window !== 'undefined') window.addEventListener('languagechange', () => { if (preference === 'system') update(); });
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useLanguage() { useSyncExternalStore(subscribe, () => `${preference}:${resolved}`); return { language: preference, resolved, setLanguage }; }
export function t(source: string, ...values: unknown[]) {
  const translated = resolved === 'en' ? (english as Record<string, string>)[source] ?? source : source;
  return translated.replace(/\{(\d+)\}/g, (match, index) => Number(index) < values.length ? String(values[Number(index)]) : match);
}
export function tf(parts: TemplateStringsArray, ...values: unknown[]) {
  return t(parts.reduce((key, part, index) => key + (index ? `{${index - 1}}` : '') + part, ''), ...values);
}
