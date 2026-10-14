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
  return { kind, target: kind === 'book' && month && !range ? `${proposedYear}-${String(month).padStart(2, '0')}` : '', taxYear: /귀속/.test(item) || kind === 'adjust' ? explicitYear || '' : '', confirmed: Boolean(explicitYear && month && kind === 'book' && !range), range: range ? [+range[1], +range[2]] : null, proposedYear };
}
export function validInvoice(r) { return /^20\d{2}-(0[1-9]|1[0-2])$/.test(r.target) && Number.isFinite(r.net) && Number.isFinite(r.vat) && !r.range && (r.kind !== 'adjust' || /^20\d{2}$/.test(String(r.taxYear))); }
export function paidAt(invoice, receipts, cutoff) { return sum(receipts.filter(r => r.invoiceId === invoice.id && r.date <= cutoff).map(r => r.amount)); }
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
