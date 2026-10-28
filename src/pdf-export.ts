import { t } from './i18n';
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import html2canvas from 'html2canvas';

const mathFonts = import.meta.glob<string>('/node_modules/katex/dist/fonts/*.ttf', { query: '?url', import: 'default', eager: true });
const fontBytes = new Map<string, Promise<ArrayBuffer>>();
function loadFont(url: string) {
  if (!fontBytes.has(url)) fontBytes.set(url, fetch(url).then(response => {
    if (!response.ok) throw new Error(t('PDF 字体加载失败，请重新尝试导出。'));
    return response.arrayBuffer();
  }).catch(error => { fontBytes.delete(url); throw error; }));
  return fontBytes.get(url)!;
}

export interface PageRange { start: number; end: number }
export interface KeepTogether { top: number; bottom: number }

/** Keep rows, equations and short code blocks intact; oversized blocks may flow. */
export function paginate(height: number, capacity: number, blocks: KeepTogether[], lines: KeepTogether[]): PageRange[] {
  const pages: PageRange[] = [];
  let start = 0;
  while (start < height) {
    let end = Math.min(height, start + capacity);
    if (end < height) {
      const crossing = blocks.filter(block => block.top > start + 1 && block.bottom - block.top <= capacity && block.top < end && block.bottom > end);
      if (crossing.length) end = Math.min(...crossing.map(block => block.top));
      // A wrapped line / table row can have several overlapping text rectangles.
      for (;;) {
        const cuts = lines.filter(line => line.top < end - 0.1 && line.bottom > end + 0.1 && line.top > start + 1);
        if (!cuts.length) break;
        end = Math.min(...cuts.map(line => line.top));
      }
    }
    pages.push({ start, end }); start = end;
  }
  return pages;
}

interface TextLine extends KeepTogether {
  text: string; width: number; left: number; baseline: number; size: number;
  family: string; bold: boolean; italic: boolean; color: number[];
}

/** The browser supplies the visual layer; selectable text is positioned over it. */
export async function textPdf(surface: HTMLElement, title: string): Promise<Blob> {
  const base = import.meta.env.BASE_URL;
  const regularUrl = `${base}fonts/NotoSansSC-Regular.ttf`, boldUrl = `${base}fonts/NotoSansSC-Bold.ttf`;
  await document.fonts.ready;
  const bounds = surface.getBoundingClientRect();
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
  const lines: TextLine[] = [];
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode as Text, parent = node.parentElement!;
    if (parent.closest('.katex-mathml') || !node.data) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 600, italic = style.fontStyle === 'italic';
    const family = style.fontFamily.split(',')[0].trim().replace(/["']/g, '');
    context.font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${size}px "${family}"`;
    const metrics = context.measureText('Hg');
    const ascent = metrics.fontBoundingBoxAscent ?? size * .8, descent = metrics.fontBoundingBoxDescent ?? size * .2;
    const color = (style.color.match(/[\d.]+/g) || ['51', '51', '51']).slice(0, 3).map(Number);
    let line: TextLine | undefined;
    let offset = 0;
    for (const char of node.data) {
      range.setStart(node, offset); offset += char.length; range.setEnd(node, offset);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height || /[\r\n\u200b\u2060]/.test(char)) { line = undefined; continue; }
      const top = rect.top - bounds.top, bottom = rect.bottom - bounds.top;
      const rendered = char === '\t' ? '    ' : char;
      if (line && Math.abs(line.top - top) < 0.5 && Math.abs(line.bottom - bottom) < 0.5) { line.text += rendered; line.width = rect.right - bounds.left - line.left; }
      else {
        line = { text: rendered, width: rect.width, left: rect.left - bounds.left, top, bottom,
          baseline: top + (rect.height - ascent - descent) / 2 + ascent,
          size, family, bold, italic, color };
        lines.push(line);
      }
    }
  }
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  pdf.setTitle(title); pdf.setCreator('Chartelis'); pdf.setProducer('Chartelis');
  const embedded = new Map<string, PDFFont>();
  async function fontFor(line: TextLine) {
    const suffix = line.bold ? line.italic ? 'BoldItalic' : 'Bold' : line.italic ? 'Italic' : 'Regular';
    const filename = `${line.family}-${suffix}.ttf`;
    const mathUrl = Object.entries(mathFonts).find(([key]) => key.endsWith(`/${filename}`))?.[1];
    const url = mathUrl || (line.bold ? boldUrl : regularUrl);
    let font = embedded.get(url);
    // fontkit's CJK subsetting drops composite glyphs in some PDF readers.
    // Keep complete CJK fonts; KaTeX's small static fonts can be safely subset.
    if (!font) {
      // Search text must use glyphs with Unicode mappings, not contextual alternates.
      font = await pdf.embedFont(await loadFont(url), { subset: !!mathUrl, features: { liga: false, clig: false, calt: false, ccmp: false, locl: false, rlig: false, rclt: false, frac: false, numr: false, dnom: false } });
      embedded.set(url, font);
    }
    return { font, syntheticItalic: line.italic && !mathUrl };
  }
  const protectedBlocks: KeepTogether[] = [...surface.querySelectorAll('tr, pre, .katex-display, img, h1, h2, h3, h4, h5, h6')].map(element => {
    const rect = element.getBoundingClientRect();
    const next = /^H[1-6]$/.test(element.tagName) ? element.nextElementSibling?.getBoundingClientRect() : undefined;
    return { top: rect.top - bounds.top, bottom: Math.max(rect.bottom, next ? Math.min(next.bottom, next.top + 40) : 0) - bounds.top };
  });
  const pageWidth = 595.28, pageHeight = 841.89, margin = 36;
  const scale = (pageWidth - margin * 2) / bounds.width;
  const pages = paginate(surface.scrollHeight, (pageHeight - margin * 2) / scale, protectedBlocks, lines);
  for (const slice of pages) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    // Preserve the browser-rendered fonts and styling exactly. A transparent text
    // layer below provides search/copy without replacing the visible glyphs.
    const pageBackground = getComputedStyle(surface).backgroundColor;
    const background = await html2canvas(surface, { scale: 2, y: slice.start, height: slice.end - slice.start,
      backgroundColor: pageBackground, useCORS: true, logging: false });
    const pageColor = (pageBackground.match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map(Number);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(pageColor[0] / 255, pageColor[1] / 255, pageColor[2] / 255) });
    const image = await pdf.embedPng(background.toDataURL('image/png'));
    page.drawImage(image, { x: margin, y: pageHeight - margin - (slice.end - slice.start) * scale, width: bounds.width * scale, height: (slice.end - slice.start) * scale });
    for (const line of lines.filter(line => (line.top + line.bottom) / 2 >= slice.start && (line.top + line.bottom) / 2 < slice.end)) {
      const { font } = await fontFor(line);
      const textWidth = font.widthOfTextAtSize(line.text, line.size * scale);
      const stretch = textWidth > 0 ? line.width * scale / textWidth : 1;
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(stretch, 0, 0, 1, margin + line.left * scale, 0));
      page.drawText(line.text, { x: 0, y: pageHeight - margin - (line.baseline - slice.start) * scale,
        size: line.size * scale, font, opacity: 0, color: rgb(0, 0, 0) });
      page.pushOperators(popGraphicsState());
    }
    // Give the browser time to paint progress and respond between pages.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
