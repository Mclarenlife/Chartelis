import { useSyncExternalStore } from 'react';

export const latexPreferenceKey = 'chartelis.latexDelimiters';
const listeners = new Set<() => void>();
let enabled = false;
try { enabled = localStorage.getItem(latexPreferenceKey) === 'true'; } catch { /* Default to standard Markdown math. */ }
export const latexCompatibility = () => enabled;
export const subscribeLatexCompatibility = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setLatexCompatibility(value: boolean) {
  // Report persistence failures to the settings UI rather than silently losing the preference.
  localStorage.setItem(latexPreferenceKey, String(value));
  enabled = value;
  listeners.forEach(listener => listener());
}
export function useLatexCompatibility() { return useSyncExternalStore(subscribeLatexCompatibility, latexCompatibility); }
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === latexPreferenceKey || event.key === null) {
    enabled = event.key === null ? false : event.newValue === 'true';
    listeners.forEach(listener => listener());
  }
});
