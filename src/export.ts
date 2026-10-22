import { unified } from 'unified';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkHighlight } from './highlight';
import { remarkTextColor } from './text-color';
import { createPreviewSurface, type PreviewSnapshot } from './preview-export';
import { desktop } from './files';
import { nativeDialogTitle } from './platform';
import type { DocumentEntry } from './document';
import { wordMath } from './word-math';

export type ExportFormat = 'pdf' | 'png' | 'docx';
export async function markdownHtml(markdown: string) {
  // Raw HTML is deliberately not executed in the export surface.
  return String(await unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkHighlight).use(remarkTextColor).use(remarkRehype).use(rehypeKatex, { throwOnError: false, trust: false }).use(rehypeStringify).process(markdown));
}

export async function wordBlob(markdown: string, title: string) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ExternalHyperlink, HeadingLevel, WidthType, LevelFormat, AlignmentType } = await import('docx');
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkHighlight).use(remarkTextColor);
  const tree: any = processor.runSync(processor.parse(markdown));
  const numbering: any[] = [];
  function inline(node: any, style: any = {}): any[] {
    if (node.type === 'inlineMath') return [wordMath(node.value)];
    if (node.type === 'text') return [new TextRun({ text: node.value, ...style })];
    if (node.type === 'break') return [new TextRun({ break: 1 })];
    if (node.type === 'inlineCode') return [new TextRun({ text: node.value, font: 'Consolas', shading: { fill: 'F0EFEB' }, ...style })];
    if (node.type === 'image') return [new ExternalHyperlink({ link: node.url, children: [new TextRun({ text: `[图片：${node.alt || node.url}]`, style: 'Hyperlink' })] })];
    if (node.type === 'link') return [new ExternalHyperlink({ link: node.url, children: node.children.flatMap((child: any) => inline(child, { ...style, style: 'Hyperlink' })) })];
    const next = { ...style, ...(node.type === 'textColor' ? { color: node.color.slice(1) } : {}), ...(node.type === 'strong' ? { bold: true } : node.type === 'emphasis' ? { italics: true } : node.type === 'delete' ? { strike: true } : node.type === 'highlight' ? { highlight: 'yellow' } : {}) };
    return (node.children || []).flatMap((child: any) => inline(child, next));
  }
  function blocks(nodes: any[], level = 0): any[] {
    return nodes.flatMap(node => {
      if (node.type === 'math') return [new Paragraph({ children: [wordMath(node.value, true)], alignment: AlignmentType.CENTER, spacing: { before: 160, after: 200 }, keepLines: true })];
      if (node.type === 'heading') return [new Paragraph({ heading: HeadingLevel[`HEADING_${node.depth}` as keyof typeof HeadingLevel], children: inline(node), spacing: { before: 240, after: 140 }, keepNext: true, keepLines: true })];
      if (node.type === 'paragraph') return [new Paragraph({ children: inline(node), spacing: { after: 160, line: 340 }, widowControl: true })];
      if (node.type === 'code') return node.value.split('\n').map((line: string, index: number, codeLines: string[]) => new Paragraph({ children: [new TextRun({ text: line.replace(/\t/g, '    ') || ' ', font: { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: 'Microsoft YaHei' }, size: 19 })], shading: { fill: 'F3F3F0' }, indent: { left: 160, right: 160 }, spacing: { before: index === 0 ? 120 : 0, after: index === codeLines.length - 1 ? 160 : 0, line: 260 }, keepNext: codeLines.length <= 20 && index < codeLines.length - 1, keepLines: true }));
      if (node.type === 'blockquote') return node.children.flatMap((child: any) => child.type === 'paragraph' ? [new Paragraph({ children: inline(child, { color: '747565' }), indent: { left: 320 }, border: { left: { color: 'B09B77', size: 18, style: 'single', space: 12 } }, spacing: { after: 160 } })] : blocks([child], level));
      if (node.type === 'thematicBreak') return [new Paragraph({ border: { bottom: { color: 'DDDDDD', size: 6, style: 'single' } } })];
      if (node.type === 'table') return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 120, right: 120 }, rows: node.children.map((row: any, i: number) => new TableRow({ tableHeader: i === 0, children: row.children.map((cell: any, column: number) => new TableCell({ shading: i === 0 ? { fill: 'F0EFEB' } : undefined, children: [new Paragraph({ children: cell.children.flatMap((child: any) => inline(child, { bold: i === 0 })), alignment: node.align?.[column] === 'center' ? AlignmentType.CENTER : node.align?.[column] === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT, spacing: { after: 0, line: 300 } })] })) })) }), new Paragraph({ spacing: { after: 100 } })];
      if (node.type === 'list') {
        const reference = `list-${numbering.length}`;
        if (node.ordered) numbering.push({ reference, levels: [{ level: Math.min(level, 8), format: LevelFormat.DECIMAL, text: `%${Math.min(level, 8) + 1}.`, start: node.start ?? 1, alignment: AlignmentType.START }] });
        return node.children.flatMap((item: any) => {
          const first = item.children[0];
          const task = typeof item.checked === 'boolean';
          return [new Paragraph({ children: [...(task ? [new TextRun(item.checked ? '☑ ' : '☐ ')] : []), ...inline(first)],
            ...(task ? {} : node.ordered ? { numbering: { reference, level: Math.min(level, 8) } } : { bullet: { level: Math.min(level, 8) } }), spacing: { after: 100 } }), ...blocks(item.children.slice(1), level + 1)];
        });
      }
      return node.children ? blocks(node.children, level) : [];
    });
  }
  const children = blocks(tree.children);
  return Packer.toBlob(new Document({ title, creator: 'Chartelis', styles: { default: { document: { run: { font: { ascii: 'Calibri', hAnsi: 'Calibri', eastAsia: 'Microsoft YaHei' }, size: 22, color: '363832' } } } }, numbering: { config: numbering }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }] }));
}

export async function visualBlob(markdown: string, format: 'png' | 'pdf', title = 'Chartelis', preview?: PreviewSnapshot) {
  const { default: html2canvas } = await import('html2canvas');
  const surface = createPreviewSurface(preview ?? { html: await markdownHtml(markdown), width: 832, font: 'serif', variables: {} });
  try {
    await document.fonts.ready;
    await Promise.all([...surface.querySelectorAll('img')].map(async img => {
      try { await img.decode(); } catch { const fallback = document.createElement('p'); fallback.textContent = `[图片未能载入：${img.alt || img.getAttribute('src')}]`; img.replaceWith(fallback); }
    }));
    const height = surface.scrollHeight;
    if (format === 'png') {
      if (height > 30000) throw new Error('文稿过长，超过单张图片限制，请改用分页 PDF。');
      const canvas = await html2canvas(surface, { scale: Math.min(2, 30000 / height), backgroundColor: getComputedStyle(surface).backgroundColor, useCORS: true, logging: false });
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败')), 'image/png'));
    }
    const { textPdf } = await import('./pdf-export');
    return await textPdf(surface, title);
  } finally { surface.remove(); }
}

export async function exportDocument(doc: DocumentEntry, format: ExportFormat, preview?: PreviewSnapshot) {
  const filename = doc.name.replace(/\.(md|markdown|mdown|txt)$/i, '') + '.' + format;
  let path: string | null = null;
  if (desktop) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    path = await save({ defaultPath: filename, title: nativeDialogTitle('导出文稿'), filters: [{ name: format.toUpperCase(), extensions: [format] }] });
    if (!path) return false;
  }
  const blob = format === 'docx' ? await wordBlob(doc.markdown, doc.name) : await visualBlob(doc.markdown, format, doc.name, preview);
  if (path) {
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  } else {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return true;
}
