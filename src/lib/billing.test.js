import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDescription, splitInvoice, validateGroups, paidAt, matchClient, periodMonths } from './billing.js';
test('issue date and service month stay separate, with explicit year confirmation', () => {
  assert.equal(parseDescription('2026년 8월분 기장료', '2026-10-10').target, '2026-08');
  assert.equal(parseDescription('9월 기장수수료', '2026-10-10').target, '2026-09');
  assert.equal(parseDescription('9월 기장수수료', '2026-10-10').confirmed, false);
  assert.equal(parseDescription('12월 기장료', '2026-01-10').target, '2025-12');
  const adjustment = parseDescription('2025년 귀속 종합소득세 조정료', '2026-05-10');
  assert.equal(adjustment.taxYear, 2025); assert.equal(adjustment.target, '');
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
