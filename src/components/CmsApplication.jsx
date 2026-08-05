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
    id: String(client.id), companyName: client.company_name || "",
    businessNumber: client.business_number || client.business_reg_no || "",
    ownerName: client.owner_name || client.representative || "",
    residentNumber: client.resident_number || "", entityType: client.entity_type || client.filing_type || "개인",
    taxType: client.tax_type || "일반과세", phone: client.phone || "", mobile: client.phone2 || client.phone || "",
  };
}

function Field({ label, children, wide = false }) {
  return <label className={`cms-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

function Mark({ active, children }) {
  return <span>{active ? "☑" : "□"} {children}</span>;
}

export default function CmsApplication({ clients }) {
  const [form, setForm] = useState(emptyForm);
  const clientOptions = useMemo(() => clients.map(normalizeClient).sort((a, b) => a.companyName.localeCompare(b.companyName, "ko")), [clients]);
  const [year = "", month = "", day = ""] = form.applicationDate.split("-");
  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  function selectClient(id) {
    const client = clientOptions.find((item) => item.id === id);
    if (!client) return setForm({ ...emptyForm, applicationDate: today() });
    setForm((prev) => ({
      ...prev, clientId: id, companyName: client.companyName, businessNumber: client.businessNumber,
      ownerName: client.ownerName, residentNumber: client.residentNumber,
      entityType: client.entityType.includes("법인") ? "법인" : "개인",
      taxType: client.taxType.includes("간이") ? "간이" : client.taxType.includes("면세") ? "면세" : "일반",
      depositor: client.ownerName, depositorBirth: client.residentNumber.replace(/\D/g, "").slice(0, 6),
      phone: client.phone, mobile: client.mobile, applicantName: client.ownerName,
    }));
  }

  const dateText = `${year} 년  ${month} 월  ${day} 일`;

  return (
    <div className="cms-workspace">
      <section className="panel cms-editor no-print">
        <div className="panel-header">
          <div><h2>CMS 신청서 빠른 작성</h2><p>거래처를 선택한 뒤 계좌 정보만 입력하면 원본 서식 한 장으로 출력됩니다.</p></div>
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
          <Field label="예금주 생년월일 / 사업자등록번호"><input className="required-entry" value={form.depositorBirth} onChange={(e) => set("depositorBirth", e.target.value)} /></Field>
          <Field label="거래은행"><input className="required-entry" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
          <Field label="계좌번호"><input className="required-entry" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></Field>
          <Field label="연락처"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="휴대전화"><input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} /></Field>
          <Field label="예금주와 관계"><input value={form.relationship} onChange={(e) => set("relationship", e.target.value)} /></Field>
          <Field label="출금일"><div className="cms-radio-row">{["5", "15", "25", "기타"].map((value) => <label key={value}><input type="radio" name="debitDay" checked={form.debitDay === value} onChange={() => set("debitDay", value)} />{value}{value !== "기타" && "일"}</label>)}</div></Field>
          <Field label="신청일"><input type="date" value={form.applicationDate} onChange={(e) => set("applicationDate", e.target.value)} /></Field>
          <Field label="신청인"><input value={form.applicantName} onChange={(e) => set("applicantName", e.target.value)} /></Field>
        </div>
      </section>

      <article className="cms-paper">
        <h1>CMS 출금이체 신청서</h1>
        <h2>□ 신청내용（ <Mark active={form.entityType === "법인"}>법인</Mark> <Mark active={form.entityType === "개인"}>개인</Mark> <Mark active={form.taxType === "간이"}>간이</Mark> <Mark active={form.taxType === "면세"}>면세</Mark> ）</h2>
        <table><tbody>
          <tr><th>상 호</th><td>{form.companyName}</td><th>사업자등록번호</th><td>{form.businessNumber}</td></tr>
          <tr><th>대 표 자</th><td>{form.ownerName}</td><th>주민등록번호</th><td>{form.residentNumber}</td></tr>
        </tbody></table>
        <h2>□ 출금이체 신청 내용 <small>（신청고객 기재란）</small></h2>
        <table><tbody>
          <tr><th>예 금 주</th><td>{form.depositor}</td><th>예금주 생년월일<br/><small>（사업자는 등록번호）</small></th><td>{form.depositorBirth}</td></tr>
          <tr><th>거래은행</th><td>{form.bankName}</td><th>계좌번호</th><td>{form.accountNumber}</td></tr>
          <tr><th>연 락 처</th><td>{form.phone}</td><th>휴대전화</th><td>{form.mobile}</td></tr>
          <tr><th>예금주와 관계</th><td>{form.relationship}</td><th>출 금 일</th><td className="cms-days">{["5", "15", "25"].map((value) => <Mark key={value} active={form.debitDay === value}>{value}일</Mark>)} <Mark active={form.debitDay === "기타"}>기타（{form.otherDebitDay}）일</Mark></td></tr>
        </tbody></table>

        <section className="cms-agreements">
          <h3>[개인정보 수집 및 이용 동의]</h3>
          <p>- 수집 및 이용목적 : CMS 출금이체를 통한 요금수납</p>
          <p>- 수집항목 : 성명, 전화번호, 휴대폰번호, 금융기관명, 계좌번호</p>
          <p>- 보유 및 이용기간 : 수집·이용 동의일로부터 CMS 출금이체 종료일(해지일) 후 5년까지</p>
          <p>- 신청자는 개인정보 수집 및 이용을 거부할 권리가 있으며, 거부 시 출금이체 신청이 거부될 수 있습니다.</p>
          <div className="cms-agree-line">동의함 {form.privacyAgree ? "☑" : "□"} / 동의안함 {!form.privacyAgree ? "☑" : "□"}</div>
          <h3>[개인정보 제3자 제공 동의]</h3>
          <p>- 개인정보를 제공받는 자 : 사단법인 금융결제원</p>
          <p>- 이용 목적 : CMS 출금이체 서비스 제공 및 출금동의 확인, 출금이체 신규등록 및 해지 사실 통지</p>
          <p>- 제공항목 : 성명, 금융기관명, 계좌번호, 생년월일, 전화번호, 휴대폰번호</p>
          <p>- 보유 및 이용기간 : CMS 출금이체 서비스 제공 및 출금동의 확인 목적을 달성할 때까지</p>
          <div className="cms-agree-line">동의함 {form.thirdPartyAgree ? "☑" : "□"} / 동의안함 {!form.thirdPartyAgree ? "☑" : "□"}</div>
          <div className="cms-notice"><b>[출금이체 동의여부 및 해지사실 통지 안내]</b><br/>은행 등 금융회사 및 금융결제원은 CMS 제도의 안정적 운영을 위해 고객의 연락처 정보를 활용하여 출금이체 동의여부 및 해지사실을 통지할 수 있습니다.</div>
        </section>
        <p className="cms-declaration">상기 금융거래정보의 제공 및 개인정보의 수집 및 이용, 제3자 제공에 동의하며 CMS 출금이체를 신청합니다.</p>
        <p className="cms-date">{dateText}</p>
        <p className="cms-sign">신청인 : {form.applicantName} （서명 또는 인）</p>

        <section className="cms-tax-box">
          <h1>세무정보 이용 및 조회 동의서</h1>
          <p>상기인은 당해 세무대리인이 좀 더 나은 세무서비스의 제공과 효율적인 회계 및 세무업무 처리를 위한 목적으로 국세청의 홈택스 및 전자세금계산서 시스템에서 제공하는 세무정보를 이용하도록 하는데 동의합니다.</p>
          <div className="cms-tax-scope">○ 세무정보 이용 대상 : 세무대리인에게 기장 의뢰한 업체 / ○ 세무정보 이용 기간 : 수임 시부터 해임 시까지<br/>○ 세무정보 이용 범위 : 홈택스 이용에 관한 규정 제40조의 정보 및 전자세금계산서 발급·수취 내역 조회</div>
          <p className="cms-date">{dateText}</p>
          <p className="cms-sign">신청인 : {form.applicantName} （서명 또는 인）</p>
          <div className="cms-agent-sign">※ 당해 세무대리인은 지득한 세무정보를 세무업무처리를 위한 목적 외에 다른 용도로 사용하지 못하며, 이를 위반 시 모든 책임을 진다.<br/><span>{dateText}</span><br/>세무대리인 : 박 세 민 （서명 또는 인）</div>
        </section>
        <footer><strong>세무법인 다승</strong><span>우)05203 서울시 강동구 고덕비즈밸리로 26 A동 215호 / T.02-488-3070 / F.02-477-3076</span></footer>
      </article>
    </div>
  );
}
