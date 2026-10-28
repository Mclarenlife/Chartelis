import { t, tf } from './i18n';
export const pluginStorageKey = 'chartelis.plugins.v1';
export const maxPluginBytes = 256 * 1024;
export const themeTokens = ['paper', 'sidebar', 'text', 'muted', 'subtle', 'line', 'hover', 'selected', 'accent', 'accent-soft', 'gold', 'surface'] as const;
export type ThemeTokens = Record<typeof themeTokens[number], string>;
export interface PluginTheme { id: string; name: string; appearance: 'light' | 'dark'; colors: ThemeTokens }
export interface PluginTemplate { id: string; name: string; filename: string; markdown: string }
export interface PluginCommand { id: string; name: string; operation: 'uppercase' | 'lowercase' | 'trim' | 'wrap' | 'prefixLines' | 'replace'; before?: string; after?: string; prefix?: string; search?: string; replacement?: string }
export interface PluginManifest { apiVersion: 1; id: string; name: string; version: string; author: string; description: string; themes: PluginTheme[]; templates: PluginTemplate[]; commands: PluginCommand[] }
export interface InstalledPlugin { manifest: PluginManifest; enabled: boolean }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('插件字段必须是对象'));
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) throw new Error(tf`不支持的插件字段：${extra}`);
}
function string(value: unknown, label: string, max = 100, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || value.includes('\0')) throw new Error(tf`${label}为空或超过长度限制`);
  return value;
}
function id(value: unknown) {
  const result = string(value, 'ID', 80);
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(result)) throw new Error(t('ID 只能使用小写字母、数字、点和连字符'));
  return result;
}
function items<T>(value: unknown, parse: (item: Record<string, unknown>) => T & { id: string }): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error(t('每类扩展最多包含 20 项'));
  const parsed = value.map(item => parse(object(item)));
  if (new Set(parsed.map(item => item.id)).size !== parsed.length) throw new Error(t('同类扩展的 ID 不能重复'));
  return parsed;
}
export function parsePlugin(text: string): PluginManifest {
  if (new TextEncoder().encode(text).length > maxPluginBytes) throw new Error(t('插件包不能超过 256 KB'));
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error(t('插件包不是有效的 JSON 文件')); }
  const data = object(parsed);
  keys(data, ['apiVersion', 'id', 'name', 'version', 'author', 'description', 'themes', 'templates', 'commands']);
  if (data.apiVersion !== 1) throw new Error(t('当前仅支持插件 API 版本 1'));
  const version = string(data.version, t('版本号'));
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error(t('插件版本应类似 1.0.0'));
  const manifest: PluginManifest = {
    apiVersion: 1, id: id(data.id), name: string(data.name, t('名称')), version, author: string(data.author, t('作者')),
    description: string(data.description ?? '', t('说明'), 500, true),
    themes: items(data.themes, value => {
      keys(value, ['id', 'name', 'appearance', 'colors']);
      if (value.appearance !== 'light' && value.appearance !== 'dark') throw new Error(t('主题必须指定 light 或 dark'));
      const colors = object(value.colors); keys(colors, [...themeTokens]);
      const normalized = {} as ThemeTokens;
      for (const token of themeTokens) {
        const color = string(colors[token], tf`颜色 ${token}`);
        if (!/^#[\da-f]{6}$/i.test(color)) throw new Error(tf`颜色 ${token} 必须为六位十六进制色值`);
        normalized[token] = color;
      }
      return { id: id(value.id), name: string(value.name, t('主题名称')), appearance: value.appearance, colors: normalized };
    }),
    templates: items(data.templates, value => {
      keys(value, ['id', 'name', 'filename', 'markdown']);
      const filename = string(value.filename, t('文件名'));
      if (!/\.md$/i.test(filename) || /[<>:"/\\|?*\x00-\x1f]/.test(filename) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(filename)) throw new Error(t('模板文件名必须是有效的 .md 文件名，不能包含路径'));
      return { id: id(value.id), name: string(value.name, t('模板名称')), filename, markdown: string(value.markdown, t('模板内容'), 50000, true) };
    }),
    commands: items(data.commands, value => {
      const op = value.operation;
      if (!['uppercase', 'lowercase', 'trim', 'wrap', 'prefixLines', 'replace'].includes(String(op))) throw new Error(t('不支持的选区操作'));
      const extra = op === 'wrap' ? ['before', 'after'] : op === 'prefixLines' ? ['prefix'] : op === 'replace' ? ['search', 'replacement'] : [];
      keys(value, ['id', 'name', 'operation', ...extra]);
      const command: PluginCommand = { id: id(value.id), name: string(value.name, t('命令名称')), operation: op as PluginCommand['operation'] };
      for (const key of extra) Object.assign(command, { [key]: string(value[key], key, 1000, key !== 'search') });
      return command;
    }),
  };
  if (!manifest.themes.length && !manifest.templates.length && !manifest.commands.length) throw new Error(t('插件至少需要提供一个主题、模板或命令'));
  return manifest;
}
export function loadPlugins(storage?: Pick<Storage, 'getItem'>): { plugins: InstalledPlugin[]; error?: string } {
  try {
    const raw = (storage ?? localStorage).getItem(pluginStorageKey);
    if (!raw) return { plugins: [] };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.plugins) || data.plugins.length > 20) throw new Error();
    const plugins: InstalledPlugin[] = data.plugins.map((entry: unknown) => {
      const value = object(entry);
      if (typeof value.enabled !== 'boolean') throw new Error();
      return { enabled: value.enabled, manifest: parsePlugin(JSON.stringify(value.manifest)) };
    });
    if (new Set(plugins.map(plugin => plugin.manifest.id)).size !== plugins.length) throw new Error();
    return { plugins };
  } catch { return { plugins: [], error: t('插件记录无法读取，已暂停加载。原始记录未覆盖；请导出备份后重置。') }; }
}
export function savePlugins(plugins: InstalledPlugin[], storage: Pick<Storage, 'setItem'> = localStorage) {
  if (plugins.length > 20) throw new Error(t('最多安装 20 个插件，请先卸载不使用的插件'));
  storage.setItem(pluginStorageKey, JSON.stringify({ version: 1, plugins }));
}
export function pluginThemeId(pluginId: string, themeId: string) { return `plugin:${pluginId}:${themeId}`; }
export function runSelectionCommand(command: PluginCommand, text: string): string {
  if (!text) throw new Error(t('请先选中需要处理的文字'));
  if (text.length > 100000) throw new Error(t('一次最多处理 10 万个字符'));
  let result: string;
  switch (command.operation) {
    case 'uppercase': result = text.toUpperCase(); break;
    case 'lowercase': result = text.toLowerCase(); break;
    case 'trim': result = text.trim(); break;
    case 'wrap': result = command.before! + text + command.after!; break;
    case 'prefixLines': {
      const lines = text.split('\n');
      if (text.length + lines.length * command.prefix!.length > 200000) throw new Error(t('处理结果过长，请缩小选区'));
      result = lines.map(line => command.prefix! + line).join('\n'); break;
    }
    case 'replace': {
      const parts = text.split(command.search!);
      if (text.length + (parts.length - 1) * (command.replacement!.length - command.search!.length) > 200000) throw new Error(t('处理结果过长，请缩小选区'));
      result = parts.join(command.replacement!); break;
    }
  }
  if (result.length > 200000) throw new Error(t('处理结果过长，请缩小选区'));
  return result;
}
export function renderTemplate(template: PluginTemplate, now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const replace = (value: string) => value.replace(/\{\{(date|time)\}\}/g, (_, key: string) => key === 'date' ? date : time);
  return { filename: template.filename.replaceAll('{{date}}', date), markdown: replace(template.markdown) };
}
