// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }));
import { isTauri, invoke } from '@tauri-apps/api/core';
import { aiSettingsKey, chatEndpoint, loadAISettings, saveAISettings, readAIKey, writeAIKey } from './ai-config';
import { readChatResponse, requestChat } from './ai-client';
import { renderAIMarkdown } from './ai-markdown';
const profile = { id: 'a9b8c7d6-1234-4567-8910-123456789abc', name: 'Test', model: 'test-model', baseUrl: 'https://example.com/v1' };
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.mocked(isTauri).mockReturnValue(false); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function stream(text: string, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
describe('AI API configuration and credentials', () => {
  it('accepts base and full endpoints, including local models; rejects unsafe URLs', () => {
    expect(chatEndpoint('https://example.com')).toBe('https://example.com/v1/chat/completions');
    expect(chatEndpoint('https://example.com/custom/v1/')).toBe('https://example.com/custom/v1/chat/completions');
    expect(chatEndpoint('https://example.com/v1/chat/completions')).toBe('https://example.com/v1/chat/completions');
    expect(chatEndpoint('http://127.0.0.1:11434/v1')).toContain(':11434/v1/chat/completions');
    for (const url of ['http://remote.example/v1', 'javascript:alert(1)', 'file:///tmp', 'https://user:password@example.com', 'https://example.com?key=secret']) expect(() => chatEndpoint(url)).toThrow();
  });
  it('persists multiple configurations and selection without serializing keys', async () => {
    const other = { ...profile, id: 'b9b8c7d6-1234-4567-8910-123456789abc', name: 'Other' };
    saveAISettings({ profiles: [{ ...profile, key: 'must-not-persist' } as typeof profile, other], activeId: other.id });
    expect(loadAISettings()).toEqual({ profiles: [profile, other], activeId: other.id });
    expect(localStorage.getItem(aiSettingsKey)).not.toContain('must-not-persist');
    await writeAIKey(profile.id, 'test-session-key');
    expect(await readAIKey(profile.id)).toBe('test-session-key');
    expect(JSON.stringify(localStorage)).not.toContain('test-session-key');
    await writeAIKey(profile.id, ''); expect(await readAIKey(profile.id)).toBe('');
  });
  it('uses the native credential store in desktop mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true); vi.mocked(invoke).mockResolvedValue('native-test-key');
    await writeAIKey(profile.id, 'native-test-key');
    expect(invoke).toHaveBeenCalledWith('ai_set_key', { id: profile.id, key: 'native-test-key' });
    expect(await readAIKey(profile.id)).toBe('native-test-key');
    await writeAIKey(profile.id, ''); expect(invoke).toHaveBeenCalledWith('ai_delete_key', { id: profile.id });
    expect(sessionStorage.length).toBe(0);
  });
  it('reports damaged settings without silently overwriting them', () => {
    localStorage.setItem(aiSettingsKey, '{broken');
    expect(() => loadAISettings()).toThrow(); expect(localStorage.getItem(aiSettingsKey)).toBe('{broken');
  });
});
describe('AI responses', () => {
  it('decodes fragmented UTF-8, CRLF, keepalive and multi-line SSE data', async () => {
    let text = '';
    await readChatResponse(stream(': keepalive\r\n\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" **world**"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'), value => { text = value; });
    expect(text).toBe('你好 **world**');
  });
  it('supports non-streaming responses from compatible servers', async () => {
    const next = vi.fn();
    await readChatResponse(new Response(JSON.stringify({ choices: [{ message: { content: '# Title' } }] }), { headers: { 'content-type': 'application/json' } }), next);
    expect(next).toHaveBeenLastCalledWith('# Title');
  });
  it('handles authentication errors without reflecting provider secrets', async () => {
    await expect(readChatResponse(new Response('secret-token', { status: 401 }), vi.fn())).rejects.toThrow('HTTP 401');
    await expect(readChatResponse(stream('data: {"error":{"message":"secret-token"}}\n\n'), vi.fn())).rejects.not.toThrow('secret-token');
    await expect(readChatResponse(stream('data: invalid\n\n'), vi.fn())).rejects.toThrow();
  });
  it('reports empty replies and truncation while preserving partial output', async () => {
    await expect(readChatResponse(stream('data: [DONE]\n\n'), vi.fn())).rejects.toThrow();
    const text = vi.fn();
    await expect(readChatResponse(stream('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'), text)).rejects.toThrow();
    expect(text).toHaveBeenLastCalledWith('partial');
    await expect(readChatResponse(stream('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'), vi.fn())).rejects.toThrow();
  });
  it('sends only explicit conversation data to the selected endpoint and respects abort', async () => {
    await writeAIKey(profile.id, 'dummy-key');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })));
    vi.stubGlobal('fetch', fetcher);
    const messages = [{ role: 'user' as const, content: 'Only this question' }];
    await requestChat(profile, messages, new AbortController().signal, vi.fn());
    expect(fetcher).toHaveBeenCalledWith('https://example.com/v1/chat/completions', expect.objectContaining({ redirect: 'error', headers: expect.objectContaining({ Authorization: 'Bearer dummy-key' }) }));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ model: 'test-model', messages, stream: true });
    const controller = new AbortController(); controller.abort();
    await expect(requestChat(profile, messages, controller.signal, vi.fn())).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
describe('AI Markdown rendering', () => {
  it('renders headings, tables, tasks, fenced code and formulas', () => {
    const html = renderAIMarkdown('# Title\n\n**Bold**\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] Done\n\n```js\nconst x = 1;\n```\n\n$E=mc^2$');
    for (const tag of ['<h1>', '<strong>', '<table>', 'checkbox', '<pre><code class="language-js">', 'class="katex"']) expect(html).toContain(tag);
  });
  it('does not execute HTML, load images, or allow script/data links', () => {
    const html = renderAIMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert%281%29)\n\n![tracking](https://remote.test/pixel)\n\n[x][bad]\n\n[bad]: data:text/html,bad\n\n[Safe](https://example.com)');
    expect(html).not.toMatch(/<script|<img|onerror|href="javascript:|href="data:/);
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
