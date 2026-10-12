import { describe, expect, it } from 'vitest';
import example from '../examples/plugins/writing-kit.chartelis-plugin.json';
import { loadPlugins, parsePlugin, pluginStorageKey, renderTemplate, runSelectionCommand, savePlugins } from './plugins';

const parse = (change: Record<string, unknown> = {}) => parsePlugin(JSON.stringify({ ...example, ...change }));
describe('plugin boundary and persistence', () => {
  it('loads a complete plugin and rejects incompatible or executable packages', () => {
    expect(parse().themes[0].appearance).toBe('dark');
    expect(() => parse({ apiVersion: 2 })).toThrow('版本');
    expect(() => parse({ script: 'fetch("https://example.com")' })).toThrow('script');
    expect(() => parse({ commands: [{ id: 'bad', name: 'bad', operation: 'eval' }] })).toThrow('不支持');
    expect(() => parse({ themes: [], templates: [], commands: [] })).toThrow('至少');
    expect(() => parsePlugin('{')).toThrow('JSON');
    expect(() => parsePlugin(' '.repeat(300000))).toThrow('256');
  });
  it('rejects CSS injection, duplicate IDs and template path traversal', () => {
    expect(() => parse({ themes: [{ ...example.themes[0], colors: { ...example.themes[0].colors, paper: 'url(https://evil.test)' } }] })).toThrow('色值');
    expect(() => parse({ commands: [example.commands[0], example.commands[0]] })).toThrow('重复');
    expect(() => parse({ templates: [{ ...example.templates[0], filename: '../secret.md' }] })).toThrow('路径');
    expect(() => parse({ templates: [{ ...example.templates[0], filename: 'CON.md' }] })).toThrow('文件名');
  });
  it('persists enabled state and retains corrupt storage until explicitly reset', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
    savePlugins([{ manifest: parse(), enabled: false }], storage);
    expect(loadPlugins(storage).plugins[0].enabled).toBe(false);
    storage.setItem(pluginStorageKey, 'broken');
    expect(loadPlugins(storage).error).toContain('原始记录未覆盖');
    expect(storage.getItem(pluginStorageKey)).toBe('broken');
    expect(() => savePlugins([], { setItem: () => { throw Error('quota'); } })).toThrow('quota');
  });
  it('expands local dates without evaluating template text', () => {
    const result = renderTemplate(parse().templates[1], new Date(2026, 9, 13, 9, 5));
    expect(result.filename).toBe('会议纪要-2026-10-13.md');
    expect(result.markdown).toContain('2026-10-13 09:05');
  });
  it('transforms literal selection text with predictable bounds', () => {
    const command = parse().commands[0];
    expect(runSelectionCommand(command, 'hello 中文')).toBe('HELLO 中文');
    expect(runSelectionCommand(parse().commands[2], '你好')).toBe('“你好”');
    expect(runSelectionCommand({ ...command, operation: 'replace', search: '.', replacement: '$&' }, 'a.b')).toBe('a$&b');
    expect(runSelectionCommand({ ...command, operation: 'prefixLines', prefix: '$&' }, 'a\nb')).toBe('$&a\n$&b');
    expect(() => runSelectionCommand(command, '')).toThrow('选中');
    expect(() => runSelectionCommand(command, 'x'.repeat(100001))).toThrow('10 万');
    expect(() => runSelectionCommand({ ...command, operation: 'replace', search: 'x', replacement: 'y'.repeat(1000) }, 'x'.repeat(10000))).toThrow('过长');
  });
});
