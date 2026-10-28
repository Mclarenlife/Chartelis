import { t } from './i18n';
import katex from 'katex';
const markdown = [
  ['标题', '# 一级标题 / ## 二级标题 / ### 三级标题'], ['粗体 / 斜体', '**粗体** / *斜体*'], ['删除线 / 高亮', '~~删除线~~ / ==高亮=='],
  ['无序 / 有序列表', '- 条目\n1. 条目'], ['任务列表', '- [ ] 待办\n- [x] 完成'], ['引用', '> 引用文字'], ['链接 / 图片', '[文字](https://example.com)\n![描述](https://example.com/image.png)'],
  ['行内代码 / 代码块', '`代码`\n```js\nconst x = 1;\n```'], ['表格', '| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |'], ['分隔线', '---'], ['行内公式 / 独立公式', '$E=mc^2$\n\n$$\n\\frac{a}{b}\n$$'],
];
const latex = [
  ['上下标', 'x_i^2 + e^{i\\pi}'], ['分数', '\\frac{a+b}{c}'], ['根号', '\\sqrt{x} + \\sqrt[3]{y}'], ['希腊字母', '\\alpha + \\beta + \\gamma + \\theta + \\pi'],
  ['求和 / 乘积', '\\sum_{i=1}^{n} i + \\prod_{i=1}^{n} i'], ['积分', '\\int_0^1 x^2\\,dx'], ['极限', '\\lim_{x\\to 0} \\frac{\\sin x}{x}=1'],
  ['矩阵', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'], ['分段函数', 'f(x)=\\begin{cases}x & x>0 \\\\ -x & x\\le 0\\end{cases}'],
  ['多行对齐', '\\begin{aligned} a &= b+c \\\\ d &= e+f \\end{aligned}'], ['括号', '\\left(\\frac{a}{b}\\right)'], ['文本', '\\text{速度} = \\frac{\\text{距离}}{\\text{时间}}'],
];
export default function ReferenceSheet({ type }: { type: 'markdown' | 'latex' }) {
  return <div className="reference-sheet"><p>{type === 'latex' ? t('用 $…$ 包围行内公式，或用独占一行的 $$ 包围独立公式。点击公式修改，Esc 或 Ctrl/Cmd + Enter 返回正文。支持 KaTeX 数学语法。') : t('在即时预览中输入语法，或通过右键菜单插入格式。')}</p><table><thead><tr><th>{t("功能")}</th><th>{t("语法")}</th>{type === 'latex' && <th>{t("效果")}</th>}</tr></thead><tbody>{(type === 'latex' ? latex : markdown).map(([name, code]) => <tr key={name}><th>{t(name)}</th><td><code>{t(code)}</code></td>{type === 'latex' && <td dangerouslySetInnerHTML={{ __html: katex.renderToString(t(code), { throwOnError: false, trust: false }) }} />}</tr>)}</tbody></table></div>;
}
