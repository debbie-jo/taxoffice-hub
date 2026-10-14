import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedFees } from './expectedFees.js';
import { periodMonths } from './billing.js';
test('missing invoice months include customers absent from the invoice list and gaps before later payments',()=>{
const c={contract_date:'2025-07-01',bookkeeping_fee:100000,status:'계속'},ms=periodMonths(2025);
const rows=[{kind:'book',target:'2025-07',net:100000},{kind:'book',target:'2025-09',net:100000},{kind:'adjust',target:'2025-08',net:100000}];
const r=expectedFees(c,rows,ms,null,'2025-09');assert.equal(r.first,'2025-08');assert.equal(r.continuous,'2025-07');assert.equal(r.total,100000);assert.equal(r.count,1);assert.equal(r.slots[3].state,'자료 범위 밖');assert.equal(expectedFees(c,[],ms,null,'2025-09').count,3);
});
test('contract limits, partial fees and missing metadata are handled explicitly',()=>{
const c={contract_date:'2025-08-01',end_date:'2025-09-30',bookkeeping_fee:100000,status:'폐업'},ms=periodMonths(2025);
const r=expectedFees(c,[{kind:'book',target:'2025-08',net:80000}],ms,null,'2026-06');assert.equal(r.total,120000);assert.equal(r.slots[0].state,'대상 아님');assert.equal(r.slots[3].state,'대상 아님');assert.equal(expectedFees({...c,end_date:''},[],ms,null,'2026-06').missing,true);assert.equal(expectedFees({...c,contract_date:''},[],ms,null,'2026-06').missing,true);
});
