export const digits = v => String(v ?? '').replace(/\D/g, '');
export const kinds = { book: '기장료', adjust: '조정료', other: '기타 수수료' };
export const sum = values => values.reduce((a, b) => a + b, 0);
export const money = v => Number(String(v || 0).replaceAll(',', '')).toLocaleString('ko-KR');
export function periodMonths(year) { return Array.from({ length: 12 }, (_, i) => `${year + (i >= 6 ? 1 : 0)}-${String((i + 6) % 12 + 1).padStart(2, '0')}`); }
export function parseDescription(item, date) {
  const y = item.match(/(?:^|[^\d])(20\d{2}|\d{2})\s*년/);
  const range = item.match(/(1[0-2]|0?[1-9])\s*월?\s*[~～\-·,]\s*(1[0-2]|0?[1-9])\s*월/);
  const m = item.match(/(?:^|[^\d])(1[0-2]|0?[1-9])\s*월/);
  const kind = /조정/.test(item) ? 'adjust' : /기장/.test(item) ? 'book' : 'other';
  const explicitYear = y ? (+y[1] < 100 ? 2000 + +y[1] : +y[1]) : null;
  const month = m ? +m[1] : null;
  const proposedYear = explicitYear ?? (+date.slice(0, 4) - (month > +date.slice(5, 7) ? 1 : 0));
  if (/기장/.test(item) && /조정/.test(item)) return { kind: 'adjust', target: '', taxYear: explicitYear || '', confirmed: false, mixed: true, range: range ? [+range[1], +range[2]] : null, proposedYear: +date.slice(0, 4), bookMonths: range ? [+range[1], +range[2]] : month ? [month, month] : null };
  const recentMonth = !explicitYear && month && month <= +date.slice(5, 7) && +date.slice(5, 7) - month <= 2;
  return { kind, target: kind === 'book' ? month && !range ? `${proposedYear}-${String(month).padStart(2, '0')}` : '' : date.slice(0, 7), taxYear: /귀속/.test(item) || kind === 'adjust' ? explicitYear || '' : '', confirmed: kind === 'book' ? Boolean((explicitYear || recentMonth) && month && !range) : kind === 'adjust' ? Boolean(explicitYear && !range) : !range, range: range ? [+range[1], +range[2]] : null, proposedYear };
}
export function prepareReview(row) {
  if (row.confirmed || row.reviewEdited || !row.item || !row.date) return row;
  const proposal = parseDescription(row.item, row.date);
  if (proposal.confirmed && row.target === proposal.target && row.kind === proposal.kind && row.net === row.originalNet && row.vat === row.originalVat && validInvoice(row)) return { ...row, confirmed: true };
  return row;
}
export function reviewReason(row) {
  if (row.mixed || (!row.allocation && /기장/.test(row.item || '') && /조정/.test(row.item || ''))) return '기장료 + 조정료 금액 분리 필요';
  if (row.allocation && row.net === 0) return '분리 금액 입력 필요';
  if (row.range) return '여러 달 합산 · 월별 분리 필요';
  if (!row.target) return '대상 월 누락';
  if (row.kind === 'adjust' && !row.taxYear) return '조정료 귀속연도 확인';
  if (!Number.isFinite(row.net) || !Number.isFinite(row.vat)) return '금액 확인';
  if (row.reviewEdited) return '수정한 내용 확인';
  return '연도 또는 오래된 대상 월 확인';
}
export function invoiceMonth(row, basis) { return basis === 'issued' ? row.date.slice(0, 7) : row.target; }
export function checkInvoices(rows, checked) { return rows.map(r => ({ ...r, reviewEdited: true, confirmed: Boolean(checked && validInvoice(r)) })); }
export function sameRevision(a, b) {
  if (a == null || b == null) return a == null && b == null;
  const first = Date.parse(a), second = Date.parse(b);
  const remainder = value => (String(value).match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] || '').padEnd(3, '0').slice(3).replace(/0+$/, '');
  return Number.isFinite(first) && Number.isFinite(second) && first === second && remainder(a) === remainder(b);
}
export function validInvoice(r) { return !r.mixed && (r.allocation || !(/기장/.test(r.item || '') && /조정/.test(r.item || ''))) && (!r.allocation || r.net !== 0) && /^20\d{2}-(0[1-9]|1[0-2])$/.test(r.target) && Number.isFinite(r.net) && Number.isFinite(r.vat) && !r.range && (r.kind !== 'adjust' || /^20\d{2}$/.test(String(r.taxYear))); }
export function splitMixedInvoice(r) {
  const parsed = parseDescription(r.item, r.date), bounds = parsed.bookMonths;
  if (!parsed.mixed) throw Error('기장료와 조정료가 함께 적힌 품명에 사용해 주세요.');
  const base = { ...r, root: r.root || r.id, net: 0, vat: 0, originalNet: r.originalNet ?? r.net, originalVat: r.originalVat ?? r.vat, mixed: false, range: null, allocation: true, reviewEdited: true, confirmed: false };
  const months = bounds && bounds[1] >= bounds[0] ? Array.from({ length: bounds[1] - bounds[0] + 1 }, (_, i) => bounds[0] + i) : [null];
  const issuedYear = +r.date.slice(0, 4), issuedMonth = +r.date.slice(5, 7);
  return [...months.map(m => ({ ...base, id: base.root + ':book:' + (m || 'unknown'), kind: 'book', taxYear: '', target: m ? `${issuedYear - (m > issuedMonth ? 1 : 0)}-${String(m).padStart(2, '0')}` : '' })), { ...base, id: base.root + ':adjust', kind: 'adjust', taxYear: parsed.taxYear, target: r.date.slice(0, 7) }];
}
export function paidAt(invoice, receipts, cutoff) {
  if (invoice.settledByInvoice && invoice.date <= cutoff) return invoice.net + invoice.vat;
  return sum(receipts.filter(r => r.invoiceId === invoice.id && r.date <= cutoff).map(r => r.amount));
}
export function matchClient(row, clients) { const id = digits(row.business); return id ? clients.find(c => digits(c.business_number || c.business_reg_no || c.resident_number) === id) : undefined; }
export function invoiceKey(r) { return JSON.stringify([r.date, r.serial, digits(r.business), r.name, r.item, r.net, r.vat]); }
export function splitInvoice(r) {
  if (!r.range || r.range[1] < r.range[0]) throw Error('연도를 넘는 범위는 대상 월을 명확히 나누어 입력해 주세요.');
  const n = r.range[1] - r.range[0] + 1, net = Math.trunc(r.net / n), vat = Math.trunc(r.vat / n);
  return Array.from({ length: n }, (_, i) => ({ ...r, id: `${r.id}:${i}`, target: `${r.proposedYear}-${String(r.range[0] + i).padStart(2, '0')}`, net: i === n - 1 ? r.net - net * (n - 1) : net, vat: i === n - 1 ? r.vat - vat * (n - 1) : vat, range: null, confirmed: false }));
}
export function validateGroups(rows) {
  const groups = new Map(); rows.forEach(r => groups.set(r.root, [...(groups.get(r.root) || []), r]));
  return [...groups.values()].filter(rs => rs.every(r => r.confirmed && validInvoice(r)) && sum(rs.map(r => r.net)) === rs[0].originalNet && sum(rs.map(r => r.vat)) === rs[0].originalVat).flat();
}
export function downloadCsv(rows, filename) {
  const quote = v => { let s = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
