import { useState } from "react";
import "./interim-closing.css";

export default function InterimClosing({ clients, records, onChange, loading }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");
  const [status, setStatus] = useState("계속");
  const [saveError, setSaveError] = useState("");
  const [focusedAmount, setFocusedAmount] = useState("");
  const rows = clients.filter((client) => (status === "전체" || (client.status || "계속") === status)
    && [client.company_name, client.business_number, client.owner_name].join(" ").toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "", "ko"));
  const recordFor = (client) => records[`${year}:${client.id}`] || {};
  const visible = rows.filter((client) => {
    const record = recordFor(client);
    return filter === "전체" || (filter === "미확인" && !record.checked)
      || (filter === "추가 검토" && record.reviewNeeded)
      || (filter === "미전달" && !record.delivered)
      || (filter === "전달 완료" && record.delivered)
      || (filter === "회신 대기" && record.delivered && (!record.replyStatus || record.replyStatus === "회신 대기"));
  });
  function update(client, patch) {
    try {
      onChange({ ...records, [`${year}:${client.id}`]: { ...recordFor(client), ...patch } });
      setSaveError("");
    } catch {
      setSaveError("저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 입력해주세요.");
    }
  }
  return (
    <section className="panel list-panel interim-closing">
      <div className="panel-header list-header">
        <div><h2>가결산 관리</h2><p>{year}년 1월~9월 기준 · 예상세액 직접 입력 (원) · 음수는 환급 예상액</p></div>
        <div className="table-tools">
          <label>귀속연도 <select aria-label="가결산 귀속연도" value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 11 }, (_, i) => String(new Date().getFullYear() + 1 - i)).map((value) => <option key={value}>{value}</option>)}</select></label>
          <input aria-label="가결산 거래처 검색" placeholder="업체명, 사업자번호, 대표자 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select aria-label="거래처 상태" value={status} onChange={(e) => setStatus(e.target.value)}>{["전체", "계속", "휴업", "폐업", "이관"].map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="가결산 진행 필터" value={filter} onChange={(e) => setFilter(e.target.value)}>{["전체", "미확인", "추가 검토", "미전달", "전달 완료", "회신 대기"].map((value) => <option key={value}>{value}</option>)}</select>
        </div>
      </div>
      <div className="interim-summary" aria-live="polite">
        <span>대상 <strong>{rows.length}</strong>곳</span>
        <span>확인 완료 <strong>{rows.filter((c) => recordFor(c).checked).length}</strong>곳</span>
        <span>추가 검토 <strong>{rows.filter((c) => recordFor(c).reviewNeeded).length}</strong>곳</span>
        <span>미전달 <strong>{rows.filter((c) => !recordFor(c).delivered).length}</strong>곳</span>
        <span>회신 대기 <strong>{rows.filter((c) => { const r = recordFor(c); return r.delivered && (!r.replyStatus || r.replyStatus === "회신 대기"); }).length}</strong>곳</span>
      </div>
      {saveError && <p role="alert">{saveError}</p>}
      <p className="interim-help">입력·체크하면 자동 저장됩니다. 면세사업자의 부가세와 법인의 종소세는 해당 없음으로 표시합니다. 전달 완료 체크 시 전달일을 기록합니다.</p>
      {loading ? <p className="empty-state">거래처를 불러오는 중입니다.</p> : visible.length === 0 ? <p className="empty-state">조건에 맞는 거래처가 없습니다.</p> : (
        <div className="table-wrap"><table className="interim-table"><thead><tr>
          <th>거래처</th><th>가결산 확인</th><th>부가세 예상세액 (원)</th><th>종소세 예상세액 (원)</th><th>비고</th><th>추가 검토</th><th>검토할 내용</th><th>거래처 전달</th><th>회신 상태</th><th>안내한 방향</th><th>사장님 답변</th>
        </tr></thead><tbody>{visible.map((client) => {
          const record = recordFor(client);
          const name = client.company_name || "이름 없는 거래처";
          return <tr key={client.id} className={record.reviewNeeded ? "interim-needs-review" : ""}>
            <td><strong>{name}</strong><small>{client.business_number} · {client.owner_name}</small></td>
            <td><label className="interim-check"><input type="checkbox" aria-label={`${name} 가결산 확인`} checked={!!record.checked} onChange={(e) => update(client, { checked: e.target.checked })} />확인</label></td>
            {["vat", "income"].map((type) => {
              const isNotApplicable = (type === "vat" && client.tax_type === "면세사업자") || (type === "income" && client.entity_type === "법인");
              const amountKey = `${client.id}:${type}`;
              const rawValue = record[type] ?? "";
              const displayValue = focusedAmount === amountKey
                ? rawValue
                : rawValue === "" || !Number.isFinite(Number(rawValue))
                  ? ""
                  : Number(rawValue).toLocaleString("ko-KR");
              return <td key={type}>{isNotApplicable ? <span>해당 없음</span> : <input
                type="text"
                inputMode="numeric"
                aria-label={`${name} ${type === "vat" ? "부가세" : "종소세"} 예상세액`}
                placeholder="미입력"
                value={displayValue}
                onFocus={() => setFocusedAmount(amountKey)}
                onBlur={() => setFocusedAmount("")}
                onChange={(e) => {
                  const raw = e.target.value.split(",").join("").split("").filter((character) => character >= "0" && character <= "9" || character === "-").join("");
                  const normalized = raw.startsWith("-") ? `-${raw.slice(1).split("-").join("")}` : raw.split("-").join("");
                  update(client, { [type]: normalized });
                }}
              />}</td>;
            })}
            <td><textarea rows="2" aria-label={`${name} 비고`} placeholder="특이사항, 확인한 내용" value={record.notes || ""} onChange={(e) => update(client, { notes: e.target.value })} /></td>
            <td><label className="interim-check"><input type="checkbox" aria-label={`${name} 추가 검토 필요`} checked={!!record.reviewNeeded} onChange={(e) => update(client, { reviewNeeded: e.target.checked })} />필요</label></td>
            <td><textarea rows="2" aria-label={`${name} 검토할 내용`} placeholder="추가 확인할 자료·항목" value={record.reviewNotes || ""} onChange={(e) => update(client, { reviewNotes: e.target.value, ...(e.target.value.trim() ? { reviewNeeded: true } : {}) })} /></td>
            <td><label className="interim-check"><input type="checkbox" aria-label={`${name} 거래처 전달 완료`} checked={!!record.delivered} onChange={(e) => update(client, { delivered: e.target.checked, deliveredAt: e.target.checked ? new Date().toISOString() : "" })} />전달 완료</label>{record.delivered && record.deliveredAt && <small>{new Date(record.deliveredAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</small>}</td>
            <td><select aria-label={`${name} 회신 상태`} value={record.replyStatus || "회신 대기"} onChange={(e) => update(client, { replyStatus: e.target.value })}><option>회신 대기</option><option>회신 완료</option><option>회신 불필요</option></select></td>
            <td><textarea rows="2" aria-label={`${name} 안내한 방향`} placeholder="예: 필요경비 증빙 추가 확인" value={record.advice || ""} onChange={(e) => update(client, { advice: e.target.value })} /></td>
            <td><textarea rows="2" aria-label={`${name} 사장님 답변`} placeholder="회신 내용을 기록하세요" value={record.reply || ""} onChange={(e) => update(client, { reply: e.target.value, ...(e.target.value.trim() ? { replyStatus: "회신 완료" } : {}) })} /></td>
          </tr>;
        })}</tbody></table></div>
      )}
    </section>
  );
}
