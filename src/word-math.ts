import { t, tf } from './i18n';
import katex from 'katex';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { ImportedXmlComponent, Math as OfficeMath, type MathComponent } from 'docx';

const children = (node: Element) => Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1);
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const tag = (name: string, value = ''): string => `<m:${name}>${value}</m:${name}>`;
const prop = (name: string, value: string) => `<m:${name} m:val="${escape(value)}"/>`;
const run = (value: string, normal = false, variant = '') => {
  const script = ['double-struck', 'fraktur', 'script', 'monospace', 'sans-serif'].find(name => variant.includes(name));
  const style = variant.includes('bold') ? variant.includes('italic') ? 'bi' : 'b' : normal || (script && !variant.includes('italic')) ? 'p' : 'i';
  return tag('r', tag('rPr', (script ? prop('scr', script) : '') + prop('sty', style)) + '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>' + `<m:t xml:space="preserve">${escape(value)}</m:t>`);
};

/** Convert KaTeX's public MathML output, without depending on its internal AST. */
export function latexToOmml(source: string, display = false): string {
  let html: string;
  try {
    html = katex.renderToString(source, { output: 'mathml', displayMode: display, throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000 });
  } catch {
    throw new Error(tf`公式无法导出，请检查 LaTeX：${source.slice(0, 100)}`);
  }
  const math = new DOMParser().parseFromString(html, 'text/xml').getElementsByTagName('math')[0];
  if (!math) throw new Error(t('公式转换未生成 MathML。'));
  function sequence(items: Element[], style: string): string {
    const output: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i], parts = children(item), symbol = parts[0]?.textContent || '', name = item.localName || '';
      if (['msubsup', 'munderover', 'msub', 'munder', 'msup', 'mover'].includes(name) && /^[∑∏∐∫∬∭∮⋃⋂]$/.test(symbol)) {
        const upperOnly = ['msup', 'mover'].includes(name);
        const lower = upperOnly ? '' : parts[1] ? convert(parts[1], style) : '';
        const upper = upperOnly ? convert(parts[1], style) : parts[2] ? convert(parts[2], style) : '';
        const operand: Element[] = [];
        while (items[i + 1] && !(items[i + 1].localName === 'mo' && /^[=<>≤≥,;]$/.test(items[i + 1].textContent || ''))) operand.push(items[++i]);
        output.push(tag('nary', tag('naryPr', prop('chr', symbol) + prop('limLoc', name.includes('under') || name.includes('over') ? 'undOvr' : 'subSup') + prop('grow', '1') + prop('subHide', lower ? '0' : '1') + prop('supHide', upper ? '0' : '1')) + tag('sub', lower) + tag('sup', upper) + tag('e', sequence(operand, style))));
      } else output.push(convert(item, style));
    }
    return output.join('');
  }
  function convert(node: Element, variant = ''): string {
    const name = node.localName;
    const items = children(node);
    const style = node.getAttribute('mathvariant') || variant;
    const at = (index: number) => items[index] ? convert(items[index], style) : '';
    const all = () => sequence(items, style);
    switch (name) {
      case 'math': case 'semantics': case 'mstyle': case 'mpadded': return all();
      case 'annotation': case 'annotation-xml': return '';
      case 'mrow': {
        const first = items[0], last = items.at(-1);
        if (items.length >= 2 && first.localName === 'mo' && first.getAttribute('fence') === 'true' && (last?.getAttribute('fence') === 'true' || last?.localName === 'mtable')) {
          const closed = last.getAttribute('fence') === 'true';
          return tag('d', tag('dPr', prop('begChr', first.textContent || '') + prop('endChr', closed ? last.textContent || '' : '') + prop('grow', '1')) + tag('e', sequence(items.slice(1, closed ? -1 : undefined), style)));
        }
        return all();
      }
      case 'mi': case 'mn': case 'mo': case 'mtext': case 'ms': {
        const value = node.textContent || '';
        return run(value, name !== 'mi' || style === 'normal' || value.length > 1, style);
      }
      case 'mspace': return run(' ', true);
      case 'mfrac': return tag('f', tag('fPr', prop('type', node.getAttribute('linethickness') === '0px' ? 'noBar' : 'bar')) + tag('num', at(0)) + tag('den', at(1)));
      case 'msqrt': return tag('rad', tag('radPr', prop('degHide', '1')) + tag('deg') + tag('e', all()));
      case 'mroot': return tag('rad', tag('radPr', prop('degHide', '0')) + tag('deg', at(1)) + tag('e', at(0)));
      case 'msup': return tag('sSup', tag('e', at(0)) + tag('sup', at(1)));
      case 'msub': return tag('sSub', tag('e', at(0)) + tag('sub', at(1)));
      case 'msubsup': return tag('sSubSup', tag('e', at(0)) + tag('sub', at(1)) + tag('sup', at(2)));
      case 'mover': {
        const accent = items[1]?.textContent || '';
        if (node.getAttribute('accent') === 'true') {
          if (/[¯‾―]/.test(accent)) return tag('bar', tag('barPr', prop('pos', 'top')) + tag('e', at(0)));
          return tag('acc', tag('accPr', prop('chr', accent)) + tag('e', at(0)));
        }
        return tag('limUpp', tag('e', at(0)) + tag('lim', at(1)));
      }
      case 'munder':
        if (node.getAttribute('accentunder') === 'true' && /[¯‾―_]/.test(items[1]?.textContent || '')) return tag('bar', tag('barPr', prop('pos', 'bot')) + tag('e', at(0)));
        return tag('limLow', tag('e', at(0)) + tag('lim', at(1)));
      case 'munderover': return tag('limUpp', tag('e', tag('limLow', tag('e', at(0)) + tag('lim', at(1)))) + tag('lim', at(2)));
      case 'mtable': {
        const count = Math.max(1, ...items.map(row => children(row).length));
        const alignments = (node.getAttribute('columnalign') || '').split(/\s+/);
        const columns = Array.from({ length: count }, (_, i) => tag('mc', tag('mcPr', prop('count', '1') + prop('mcJc', alignments[i] === 'left' ? 'left' : alignments[i] === 'right' ? 'right' : 'center')))).join('');
        return tag('m', tag('mPr', tag('mcs', columns)) + items.map(row => tag('mr', Array.from({ length: count }, (_, i) => tag('e', children(row)[i] ? convert(children(row)[i], style) : '')).join(''))).join(''));
      }
      case 'mtd': case 'mtr': return all();
      case 'menclose': {
        const notation = node.getAttribute('notation') || '';
        if (notation === 'box') return tag('borderBox', tag('e', all()));
        if (notation.includes('strike')) return tag('borderBox', tag('borderBoxPr', ['Top', 'Bot', 'Left', 'Right'].map(side => prop(`hide${side}`, '1')).join('') + prop('strikeH', '1')) + tag('e', all()));
        throw new Error(tf`Word 暂不支持此公式装饰：${notation}。`);
      }
      case 'mphantom': return tag('phant', tag('phantPr', prop('show', '0') + prop('transp', '1') + prop('zeroAsc', '0') + prop('zeroDesc', '0') + prop('zeroWid', '0')) + tag('e', all()));
      default: throw new Error(tf`Word 暂不支持公式节点 ${name}，请简化该公式后重试。`);
    }
  }
  return `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${convert(math)}</m:oMath>`;
}

export function wordMath(source: string, display = false) {
  const root = new DOMParser().parseFromString(latexToOmml(source, display), 'text/xml').documentElement!;
  function component(node: Element): ImportedXmlComponent {
    const attrs = Object.fromEntries(Array.from(node.attributes).map(attr => [attr.name, attr.value]));
    const result = new ImportedXmlComponent(node.tagName, attrs);
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) result.push(component(child as Element));
      else if (child.nodeType === 3) result.push(child.nodeValue || '');
    }
    return result;
  }
  return new OfficeMath({ children: children(root).map(node => component(node) as MathComponent) });
}
