import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { remarkLatexDelimiters, resolveLatexDelimiters } from './latex-delimiters';

// Model output is untrusted. Drop raw HTML, remote images, and unsafe links.
function safeOutput() {
  return (tree: any) => {
    function walk(node: any) {
      if (!node.children) return;
      node.children = node.children.flatMap((child: any) => {
        if (child.type === 'html' || child.type === 'definition' && !safeLink(child.url)) return [];
        if (child.type === 'image' || child.type === 'imageReference') return [{ type: 'text', value: child.alt || '' }];
        walk(child);
        if (child.type === 'link' && !safeLink(child.url)) return child.children || [];
        return [child];
      });
    }
    walk(tree);
  };
}
function safeLink(url: string) { try { return ['https:', 'http:', 'mailto:'].includes(new URL(url).protocol); } catch { return false; } }
function externalLinks() {
  return (tree: any) => {
    function walk(node: any) {
      if (node.tagName === 'a') node.properties = { ...node.properties, target: '_blank', rel: 'noopener noreferrer' };
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}
const renderer = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkLatexDelimiters).use(resolveLatexDelimiters).use(safeOutput).use(remarkRehype)
  .use(rehypeKatex, { throwOnError: false, trust: false, maxExpand: 1000 }).use(externalLinks).use(rehypeStringify);
export function renderAIMarkdown(source: string) { return String(renderer.processSync(source)); }
