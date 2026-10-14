export function expectedFees(client, rows, months, schedule, coverageEnd) {
  const start = schedule?.start || String(client.contract_date || '').slice(0, 7);
  const end = schedule?.end ?? String(client.end_date || '').slice(0, 7);
  const fee = Number(String(schedule?.fee ?? client.bookkeeping_fee ?? '').replaceAll(',', ''));
  const missing = !/^20\d{2}-(0[1-9]|1[0-2])$/.test(start) || !Number.isFinite(fee) || fee <= 0 || (end && (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(end) || end < start)) || (['폐업', '이관', '휴업'].includes(client.status) && !end);
  let continuous = '', gap = false;
  const slots = months.map(month => {
    if (missing) return { month, state: '기준 확인', unpaid: 0 };
    if (month < start || (end && month > end)) return { month, state: '대상 아님', unpaid: 0 };
    if (month > coverageEnd) return { month, state: '자료 범위 밖', unpaid: 0 };
    const received = rows.filter(r => r.kind === 'book' && r.target === month).reduce((s, r) => s + r.net, 0);
    const unpaid = Math.max(0, fee - received), state = received >= fee ? '완납' : received > 0 ? '일부' : '미발행';
    if (unpaid) gap = true; else if (!gap) continuous = month;
    return { month, state, unpaid, received };
  });
  const unpaid = slots.filter(s => s.unpaid > 0);
  return { start, end, fee, missing, slots, first: unpaid[0]?.month || '', continuous, count: unpaid.length, total: unpaid.reduce((s, r) => s + r.unpaid, 0) };
}
