import { useMemo, useState } from "react";
import "./cms-application.css";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const emptyForm = {
  clientId: "", companyName: "", businessNumber: "", ownerName: "", residentNumber: "",
  entityType: "개인", taxType: "일반", depositor: "", depositorBirth: "", bankName: "",
  accountNumber: "", phone: "", mobile: "", relationship: "본인", debitDay: "15",
  otherDebitDay: "", applicationDate: today(), applicantName: "", privacyAgree: true,
  thirdPartyAgree: true, taxInfoAgree: true,
};

function normalizeClient(client) {
  return {
    id: String(client.id),
    companyName: client.company_name || "",
    businessNumber: client.business_number || client.business_reg_no || "",
    ownerName: client.owner_name || client.representative || "",
    residentNumber: client.resident_number || "",
    entityType: client.entity_type || client.filing_type || "개인",
    taxType: client.tax_type || "일반과세자",
    phone: client.phone || "",
    mobile: client.phone2 || client.phone || "",
  };
}

function Field({ label, children, wide = false }) {
  return <label className={`cms-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

function Consent({ title, checked, onChange, children }) {
  return (
    <section className="cms-consent">
      <div><h3>{title}</h3>{children}</div>
      <label><input type="checkbox" checked={checked} onChange={onChange} /><strong>동의함</strong></label>
    </section>
  );
}

export default function CmsApplication({ clients }) {
  const [form, setForm] = useState(emptyForm);
  const clientOptions = useMemo(
    () => clients.map(normalizeClient).sort((a, b) => a.companyName.localeCompare(b.companyName, "ko")),
    [clients],
  );
  const [year = "", month = "", day = ""] = form.applicationDate.split("-");
  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  function selectClient(id) {
    const client = clientOptions.find((item) => item.id === id);
    if (!client) return setForm({ ...emptyForm, applicationDate: today() });
    setForm((prev) => ({
      ...prev,
      clientId: id,
      companyName: client.companyName,
      businessNumber: client.businessNumber,
      ownerName: client.ownerName,
      residentNumber: client.residentNumber,
      entityType: client.entityType,
      taxType: client.taxType.includes("간이") ? "간이" : client.taxType.includes("면세") ? "면세" : "일반",
      depositor: `${client.ownerName}${client.companyName ? `(${client.companyName})` : ""}`,
      depositorBirth: client.residentNumber.replace(/\D/g, "").slice(0, 6),
      phone: client.phone,
      mobile: client.mobile,
      applicantName: client.ownerName,
    }));
  }

  return (
    <div className="cms-workspace">
      <section className="panel cms-editor no-print">
        <div className="panel-header">
          <div><h2>CMS 신청서 빠른 작성</h2><p>거래처를 선택한 뒤 노란색 항목만 확인하면 됩니다.</p></div>
          <div className="cms-actions">
            <button className="secondary-button" type="button" onClick={() => setForm({ ...emptyForm, applicationDate: today() })}>초기화</button>
            <button className="primary-button" type="button" onClick={() => window.print()}>인쇄 / PDF 저장</button>
          </div>
        </div>
        <div className="cms-input-grid">
          <Field label="거래처 선택" wide><select value={form.clientId} onChange={(e) => selectClient(e.target.value)}><option value="">직접 입력</option>{clientOptions.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}</select></Field>
          <Field label="상호"><input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} /></Field>
          <Field label="사업자등록번호"><input value={form.businessNumber} onChange={(e) => set("businessNumber", e.target.value)} /></Field>
          <Field label="대표자"><input value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
          <Field label="주민등록번호"><input value={form.residentNumber} onChange={(e) => set("residentNumber", e.target.value)} /></Field>
          <Field label="신청 구분"><select value={form.entityType} onChange={(e) => set("entityType", e.target.value)}><option>개인</option><option>법인</option></select></Field>
          <Field label="과세 유형"><select value={form.taxType} onChange={(e) => set("taxType", e.target.value)}><option>일반</option><option>간이</option><option>면세</option></select></Field>
          <Field label="예금주"><input className="required-entry" value={form.depositor} onChange={(e) => set("depositor", e.target.value)} /></Field>
          <Field label="예금주 생년월일/등록번호"><input className="required-entry" value={form.depositorBirth} onChange={(e) => set("depositorBirth", e.target.value)} /></Field>
          <Field label="거래은행"><input className="required-entry" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
          <Field label="계좌번호"><input className="required-entry" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></Field>
          <Field label="연락처"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="휴대전화"><input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} /></Field>
          <Field label="예금주와 관계"><input className="required-entry" value={form.relationship} onChange={(e) => set("relationship", e.target.value)} /></Field>
          <Field label="출금일"><div className="cms-radio-row">{["5", "15", "25", "기타"].map((value) => <label key={value}><input type="radio" name="debitDay" checked={form.debitDay === value} onChange={() => set("debitDay", value)} />{value}{value !== "기타" && "일"}</label>)}{form.debitDay === "기타" && <input className="other-day required-entry" value={form.otherDebitDay} onChange={(e) => set("otherDebitDay", e.target.value.replace(/\D/g, "").slice(0, 2))} />}</div></Field>
          <Field label="신청일"><input type="date" value={form.applicationDate} onChange={(e) => set("applicationDate", e.target.value)} /></Field>
          <Field label="신청인"><input className="required-entry" value={form.applicantName} onChange={(e) => set("applicantName", e.target.value)} /></Field>
        </div>
      </section>

      <article className="cms-paper">
        <header><h2>CMS 출금이체 신청서</h2><p>신청 내용을 확인한 후 서명 또는 날인해 주세요.</p></header>
        <section className="cms-doc-section">
          <h3>■ 신청내용</h3>
          <p className="cms-choice">{["법인", "개인"].map((item) => <span key={item}>{form.entityType === item ? "☑" : "☐"} {item}</span>)} {["일반", "간이", "면세"].map((item) => <span key={item}>{form.taxType === item ? "☑" : "☐"} {item}</span>)}</p>
          <dl className="cms-doc-grid"><div><dt>상호</dt><dd>{form.companyName}</dd></div><div><dt>사업자등록번호</dt><dd>{form.businessNumber}</dd></div><div><dt>대표자</dt><dd>{form.ownerName}</dd></div><div><dt>주민등록번호</dt><dd>{form.residentNumber}</dd></div></dl>
        </section>
        <section className="cms-doc-section">
          <h3>■ 출금이체 신청 내용</h3>
          <dl className="cms-doc-grid"><div><dt>예금주</dt><dd>{form.depositor}</dd></div><div><dt>생년월일/등록번호</dt><dd>{form.depositorBirth}</dd></div><div><dt>거래은행</dt><dd>{form.bankName}</dd></div><div><dt>계좌번호</dt><dd>{form.accountNumber}</dd></div><div><dt>연락처</dt><dd>{form.phone}</dd></div><div><dt>휴대전화</dt><dd>{form.mobile}</dd></div><div><dt>예금주와 관계</dt><dd>{form.relationship}</dd></div><div><dt>출금일</dt><dd>{["5", "15", "25"].map((value) => `${form.debitDay === value ? "☑" : "☐"}${value}일`).join(" / ")} / {form.debitDay === "기타" ? `☑기타(${form.otherDebitDay})일` : "☐기타( )일"}</dd></div></dl>
        </section>
        <Consent title="[개인정보 수집 및 이용 동의]" checked={form.privacyAgree} onChange={(e) => set("privacyAgree", e.target.checked)}><p>수집 및 이용목적: CMS 출금이체를 통한 요금수납</p><p>수집항목: 성명, 전화번호, 휴대폰번호, 금융기관명, 계좌번호</p><p>보유 및 이용기간: 동의일로부터 출금이체 종료일(해지일) 후 5년까지</p></Consent>
        <Consent title="[개인정보 제3자 제공 동의]" checked={form.thirdPartyAgree} onChange={(e) => set("thirdPartyAgree", e.target.checked)}><p>제공받는 자: 사단법인 금융결제원</p><p>이용 목적: CMS 출금이체 서비스 제공, 출금동의 확인 및 신규등록·해지 사실 통지</p><p>제공 항목: 성명, 금융기관명, 계좌번호, 생년월일, 전화번호, 휴대폰번호</p></Consent>
        <section className="cms-doc-section cms-notice"><h3>[출금이체 동의여부 및 해지사실 통지 안내]</h3><p>은행 등 금융회사 및 금융결제원은 CMS 제도의 안정적 운영을 위해 고객의 연락처 정보로 출금이체 동의 여부와 해지 사실을 통지할 수 있습니다.</p><p className="declaration">상기 금융거래정보의 제공 및 개인정보의 수집·이용, 제3자 제공에 동의하며 CMS 출금이체를 신청합니다.</p><p className="date-line">{year}년 {month}월 {day}일</p><p className="sign-line">신청인: <strong>{form.applicantName}</strong> (서명 또는 인)</p></section>
        <section className="cms-tax-consent"><h2>세무정보 이용 및 조회 동의서</h2><p>상기인은 세무대리인이 더 나은 세무서비스 제공과 효율적인 회계 및 세무업무 처리를 위해 국세청 홈택스 및 전자세금계산서 시스템에서 제공하는 세무정보를 이용하는 데 동의합니다.</p><ul><li>세무정보 이용 대상: 세무대리인에게 기장 의뢰한 업체</li><li>세무정보 이용 기간: 수임 시부터 해임 시까지</li><li>세무정보 이용 범위: 홈택스 제공 정보 및 전자세금계산서 발급·수취 내역 조회</li></ul><label className="tax-check no-print"><input type="checkbox" checked={form.taxInfoAgree} onChange={(e) => set("taxInfoAgree", e.target.checked)} /> 동의함</label><p className="date-line">{year}년 {month}월 {day}일</p><p className="sign-line">신청인: <strong>{form.applicantName}</strong> (서명 또는 인)</p><p className="sign-line">세무대리인: 박 세 민 (서명 또는 인)</p><footer><strong>세무법인 다승</strong><span>서울시 강동구 고덕비즈밸리로 26 A동 215호 / T.02-488-3070 / F.02-477-3076</span></footer></section>
      </article>
    </div>
  );
}
