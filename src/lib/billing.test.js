import test from 'node:test';
import assert from 'node:assert/strict';
import { sameRevision, invoiceMonth, checkInvoices, parseDescription, splitInvoice, validateGroups, paidAt, matchClient, periodMonths } from './billing.js';

test('database timestamps compare by time, while real changes still conflict', () => {
  assert.equal(sameRevision('2026-10-14T03:12:45.123Z', '2026-10-14T03:12:45.123+00:00'), true);
  assert.equal(sameRevision('2026-10-14T03:12:45.123Z', '2026-10-14T03:12:45.124+00:00'), false);
  assert.equal(sameRevision('2026-10-14T03:12:45.123Z', '2026-10-14T03:12:45.123000+00:00'), true);
  assert.equal(sameRevision('2026-10-14T03:12:45.123Z', '2026-10-14T03:12:45.123001+00:00'), false);
  assert.equal(sameRevision(null, null), true); assert.equal(sameRevision(null, '2026-10-14T03:12:45Z'), false);
  assert.equal(sameRevision('invalid', 'invalid'), false);
});
test('issue date and service month stay separate, with explicit year confirmation', () => {
  assert.equal(parseDescription('2026년 8월분 기장료', '2026-10-10').target, '2026-08');
  assert.equal(parseDescription('9월 기장수수료', '2026-10-10').target, '2026-09');
  assert.equal(parseDescription('9월 기장수수료', '2026-10-10').confirmed, false);
  assert.equal(parseDescription('12월 기장료', '2026-01-10').target, '2025-12');
  const adjustment = parseDescription('2025년 귀속 종합소득세 조정료', '2026-05-10');
  assert.equal(adjustment.taxYear, 2025); assert.equal(adjustment.target, '2026-05');
});
test('old attribution year does not move revenue out of its issuance period', () => {
  const row = { date: '2026-07-10', ...parseDescription('2024년 귀속 종합소득세 조정료', '2026-07-10') };
  assert.equal(row.taxYear, 2024); assert.equal(invoiceMonth(row, 'issued'), '2026-07');
  const delayed = { date: '2026-07-10', ...parseDescription('2026년 6월 기장료', '2026-07-10') };
  assert.equal(invoiceMonth(delayed, 'target'), '2026-06'); assert.equal(invoiceMonth(delayed, 'issued'), '2026-07');
  assert.equal(invoiceMonth({ date: '2026-06-30', target: '2026-06' }, 'issued'), '2026-06');
});
test('whole-file checking includes later pages and leaves incomplete rows unconfirmed', () => {
  const rows = Array.from({length: 85}, (_, i) => ({ id: i, target: i === 84 ? '' : '2026-08', kind: 'book', net: 100, vat: 10, confirmed: false }));
  const checked = checkInvoices(rows, true); assert.equal(checked.filter(r => r.confirmed).length, 84); assert.equal(checked[80].confirmed, true); assert.equal(checked[84].confirmed, false);
  assert.equal(checkInvoices(checked, false).some(r => r.confirmed), false);
});
test('split conserves net and VAT, and partial or mismatched groups cannot be saved', () => {
  const r = { id: 'a', root: 'a', net: 100001, vat: 10001, originalNet: 100001, originalVat: 10001, ...parseDescription('2026년 8~9월 기장료', '2026-10-10') };
  const split = splitInvoice(r); assert.deepEqual(split.map(v => v.target), ['2026-08', '2026-09']);
  assert.equal(split.reduce((s, v) => s + v.net, 0), 100001); assert.equal(split.reduce((s, v) => s + v.vat, 0), 10001);
  assert.equal(validateGroups(split).length, 0);
  const confirmed = split.map(v => ({ ...v, confirmed: true })); assert.equal(validateGroups(confirmed).length, 2);
  assert.equal(validateGroups([{ ...confirmed[0], net: 1 }, confirmed[1]]).length, 0);
});
test('payment cutoff uses actual receipt date, and client matching uses identifier', () => {
  assert.equal(paidAt({ id: 'a' }, [{ invoiceId: 'a', date: '2026-06-20', amount: 55000 }, { invoiceId: 'a', date: '2026-07-01', amount: 55000 }], '2026-06-31'), 55000);
  assert.equal(matchClient({ business: '123-45-67890' }, [{ id: 'c', business_number: '1234567890' }]).id, 'c');
  assert.equal(matchClient({ name: 'same name', business: '' }, [{ company_name: 'same name' }]), undefined);
  assert.deepEqual([periodMonths(2025)[0], periodMonths(2025)[11]], ['2025-07', '2026-06']);
});
