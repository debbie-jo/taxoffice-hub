import { useMemo, useState } from 'react';
import { money, sum } from '../lib/billing';

export default function AdjustmentManager({ clients, ledger, onSave, ready, busy, now, account }) {
  const [entity, setEntity] = useState('전체');
  const [year, setYear] = useState(String(+now.slice(0, 4) - 1));
  const [drafts, setDrafts] = useState({});
  const [filter, setFilter] = useState('unpaid'), [message, setMessage] = useState('');
  const plans = ledger.adjustmentPlans || [];
  const byKey = new Map(plans.map(p => [`${p.clientId}:${p.taxYear}`, p]));
  const invoices = ledger.invoices.filter(r => r.kind === 'adjust' && String(r.taxYear) === year);
  const allRows = useMemo(() => clients.map(client => {
    const plan = byKey.get(`${client.id}:${year}`) || {};
    const bills = invoices.filter(r => (r.clientId || account?.(r)?.id) === client.id);
    const issued = sum(bills.map(r => r.net));
    const expected = Number(plan.expected || 0);
    const paid = bills.length > 0 && bills.every(r => r.settledByInvoice || r.reconciled);
    const status = plan.excluded ? '조정료 제외' : plan.paymentMonth && issued === 0 ? '입금완료·미발행' : issued === 0 ? (expected ? '미발행·미입금' : '금액 입력 필요') : expected && issued < expected ? '일부발행' : paid || plan.paymentMonth ? '입금완료' : '입금확인 필요';
    return { client, plan, expected, issued, status };
  }).filter(r => entity === '전체' || r.client.entity_type === entity), [clients, plans, invoices, year, entity]);
  const rows = allRows.filter(r => filter === 'all' || filter === 'unpaid' && ['미발행·미입금','일부발행','입금확인 필요'].includes(r.status) || filter === 'excluded' && r.status === '조정료 제외' || filter === 'complete' && r.status.startsWith('입금완료'));

  async function update(client, values) {
    const key = `${client.id}:${year}`, old = byKey.get(key);
    const next = { id: old?.id || `adjust-plan:${key}`, clientId: client.id, name: client.company_name, entityType: client.entity_type || '개인', taxYear: year, expected: old?.expected || 0, paymentMonth: old?.paymentMonth || '', excluded: Boolean(old?.excluded), ...values };
    return await onSave({ ...ledger, adjustmentPlans: [...plans.filter(p => `${p.clientId}:${p.taxYear}` !== key), next] });
  }
  function change(client, plan, expected, key, value) { setDrafts(prev => ({ ...prev, [client.id]: { expected, paymentMonth: plan.paymentMonth || '', excluded: Boolean(plan.excluded), ...prev[client.id], [key]: value } })); }
  async function saveRow(client, plan, expected) { const draft = drafts[client.id] || { expected, paymentMonth: plan.paymentMonth || '', excluded: Boolean(plan.excluded) }; if (await update(client, { ...draft, expected: Number(draft.expected || 0) })) { setDrafts(prev => { const next = { ...prev }; delete next[client.id]; return next; }); setMessage(`${client.company_name} 조정료를 저장했습니다.`); } }

  return <div className="adjustment-manager">
    <div className="billing-toolbar">
      {['전체', '개인', '법인'].map(v => <button key={v} onClick={() => setEntity(v)}>{v}</button>)}
      <label>귀속연도<select value={year} onChange={e => setYear(e.target.value)}>{Array.from({ length: 7 }, (_, i) => <option key={i}>{+now.slice(0, 4) - i}</option>)}</select></label>
      <select aria-label="조정료 상태 구분" value={filter} onChange={e => setFilter(e.target.value)}><option value="unpaid">미발행·미입금만</option><option value="complete">입금완료</option><option value="excluded">조정료 제외</option><option value="all">전체</option></select><span>표시 {rows.length}곳 · 예상 {money(sum(rows.map(r => r.expected)))}원 · 발행 {money(sum(rows.map(r => r.issued)))}원</span>
    </div>
    {message && <p className="billing-notice" role="status">{message}</p>}
    <p>계산서를 발행하지 않은 조정료도 예상 금액을 입력하면 미발행·미입금으로 남습니다. 제외 대상은 체크하세요.</p>
    <div className="billing-scroll"><table><thead><tr><th>거래처</th><th>구분</th><th>귀속연도</th><th>예상 조정료</th><th>실제 발행액</th><th>입금월</th><th>제외</th><th>상태</th></tr></thead><tbody>
      {rows.map(({ client, plan, expected, issued, status }) => <tr key={client.id} className={client.status === '폐업' ? 'closed' : client.status === '이관' ? 'moved' : ''}>
        <td><b>{client.company_name}</b><small>{client.status}</small></td><td>{client.entity_type || '개인'}</td><td>{year}년</td>
        <td><input type="number" min="0" value={drafts[client.id]?.expected ?? expected ?? ''} placeholder="직접 입력" disabled={!ready || busy} onChange={e => change(client, plan, expected, 'expected', e.target.value)} /></td>
        <td>{money(issued)}원</td><td><input type="month" value={drafts[client.id]?.paymentMonth ?? plan.paymentMonth ?? ''} disabled={!ready || busy || (drafts[client.id]?.excluded ?? plan.excluded)} onChange={e => change(client, plan, expected, 'paymentMonth', e.target.value)} /></td>
        <td><input type="checkbox" checked={Boolean(drafts[client.id]?.excluded ?? plan.excluded)} disabled={!ready || busy} onChange={e => change(client, plan, expected, 'excluded', e.target.checked)} /></td><td>{status}<button disabled={!ready || busy || !drafts[client.id]} onClick={() => saveRow(client, plan, expected)}>이 행 저장</button></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}
