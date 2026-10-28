import { t } from './i18n';
import { useState } from 'react';
import { writeClipboard } from './clipboard';
const groups = [
  { name: '常用符号', chars: [['©', '版权'], ['®', '注册商标'], ['™', '商标'], ['§', '章节'], ['¶', '段落'], ['°', '度'], ['℃', '摄氏度'], ['•', '圆点'], ['…', '省略号'], ['—', '破折号'], ['✓', '对勾'], ['✗', '叉号'], ['★', '实心星'], ['☆', '空心星']] },
  { name: '数学', chars: [['±', '正负'], ['×', '乘号'], ['÷', '除号'], ['≠', '不等于'], ['≈', '约等于'], ['≤', '小于等于'], ['≥', '大于等于'], ['∞', '无穷'], ['√', '根号'], ['∑', '求和'], ['∫', '积分'], ['∂', '偏导'], ['∈', '属于'], ['∅', '空集']] },
  { name: '希腊字母', chars: [['α', 'alpha 阿尔法'], ['β', 'beta 贝塔'], ['γ', 'gamma 伽马'], ['δ', 'delta 德尔塔'], ['θ', 'theta 西塔'], ['λ', 'lambda 拉姆达'], ['μ', 'mu 缪'], ['π', 'pi 派'], ['σ', 'sigma 西格玛'], ['φ', 'phi 斐'], ['ω', 'omega 欧米伽'], ['Δ', '大写 Delta'], ['Σ', '大写 Sigma'], ['Ω', '大写 Omega']] },
  { name: '箭头与货币', chars: [['←', '左箭头'], ['→', '右箭头'], ['↑', '上箭头'], ['↓', '下箭头'], ['↔', '双向箭头'], ['⇒', '推出'], ['⇔', '等价'], ['↵', '回车'], ['¥', '人民币 日元'], ['€', '欧元'], ['£', '英镑'], ['₩', '韩元']] },
];
export default function CharacterSheet({ onInsert, readOnly }: { onInsert(value: string): void; readOnly: boolean }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(['©', '版权']);
  const [status, setStatus] = useState('');
  const filtered = groups.map(group => ({ ...group, chars: group.chars.filter(([char, name]) => `${char} ${name} ${t(name)} ${group.name} ${t(group.name)} U+${char.codePointAt(0)!.toString(16).padStart(4, '0')}`.toLowerCase().includes(search.trim().toLowerCase())) })).filter(group => group.chars.length);
  return <div className="character-sheet">
    <input aria-label={t("搜索字符")} placeholder={t("搜索符号、名称或 Unicode…")} value={search} onChange={event => setSearch(event.target.value)} />
    <div className="character-groups">{filtered.map(group => <section key={group.name}><h3>{t(group.name)}</h3><div className="character-grid">{group.chars.map(([char, name]) => <button key={char} title={t(name)} aria-label={`${t(name)} ${char}`} aria-pressed={selected[0] === char} onClick={() => setSelected([char, name])}>{char}</button>)}</div></section>)}{!filtered.length && <p>{t("没有找到匹配的字符")}</p>}</div>
    <div className="character-preview"><strong>{selected[0]}</strong><span>{t(selected[1])}<small>U+{selected[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}</small></span><button className="secondary-button" onClick={() => void writeClipboard(selected[0]).then(() => setStatus(t('已复制字符'))).catch(() => setStatus(t('复制失败，请重试')))}>{t("复制")}</button><button className="primary-button" disabled={readOnly} onClick={() => onInsert(selected[0])}>{t("插入")}</button></div>
    {readOnly && <p className="settings-note">{t("当前为只读模式，可以复制字符。")}</p>}{status && <p role="status">{status}</p>}
  </div>;
}
