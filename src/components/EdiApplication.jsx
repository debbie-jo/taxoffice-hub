import { useEffect, useMemo, useRef, useState } from "react";
import "./edi-application.css";

const office = Object.freeze({
  name: "세무법인다승", owner: "박세민", management: "823-85-00263-0",
  business: "823-85-00263", corporate: "110171-0086014", birth: "1972-09-27",
  maskedBirth: "720927-1******", phone: "02-488-3070",
  address: "서울시 강동구 고덕비즈밸리로 26 강동U1센터 A동 215호",
  laborAddress: "서울시 강동구 고덕비즈밸리로 26, A동 215호",
});
const types = { pension: "국민연금", health: "건강보험", labor: "고용·산재" };
const stampUrl = (name) => `${import.meta.env.BASE_URL}edi/office-${name}.jpg`;
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
const blank = () => ({
  clientId: "", company: "", business: "", management: "", corporate: "", address: "",
  owner: "", birth: "", maskedBirth: "", ownerPhone: "", workers: "",
  industry: "", pensionBranch: "", healthBranch: "", date: today(), startDate: today(), employment: true, accident: true,
});
function dateText(value) {
  const [y = "", m = "", d = ""] = value.split("-");
  return `${y || "    "} 년  ${m || "  "} 월  ${d || "  "} 일`;
}
function managementNumber(businessNumber) {
  const digits = businessNumber.replace(/\D/g, "");
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}-0` : "";
}
function Field({ label, children, wide = false }) {
  return <label className={`edi-field${wide ? " edi-wide" : ""}`}><span>{label}</span>{children}</label>;
}
function Signature({ label, name, stamp, size = 16 }) {
  return <div className="edi-signature"><span>{label}</span><strong>{name}</strong><span className="edi-sign-place">(서명 또는 인){stamp && <img src={stamp} alt={`${label} 도장`} style={{ width: `${size}mm`, height: `${size}mm` }} />}</span></div>;
}
function Pension({ form: f, clientStamp, officeStamp, stampSize }) {
  return <article className="edi-paper edi-pension" aria-label="국민연금 신청서">
    <p className="edi-form-number">[별지 제4호서식]</p>
    <h1>국민연금 웹 EDI 업무대행 신청서</h1>
    <table className="edi-receipt"><tbody><tr><th>접수번호</th><td></td><th>접수일</th><td></td><th>처리기간</th><td>즉시</td></tr></tbody></table>
    <table><colgroup><col style={{ width: "12%" }} /><col style={{ width: "18%" }} /><col style={{ width: "23%" }} /><col style={{ width: "23%" }} /><col style={{ width: "24%" }} /></colgroup><tbody>
      <tr><th rowSpan="5" className="edi-group">업무<br />대행기관</th><th>사업장관리번호</th><td>{office.management}</td><th>사업장 명칭</th><td>{office.name}</td></tr>
      <tr><th>소 재 지</th><td colSpan="3">{office.address}</td></tr>
      <tr><th>사업자등록번호</th><td>{office.business}</td><th>법인등록번호</th><td>{office.corporate}</td></tr>
      <tr><th rowSpan="2">사용자</th><th colSpan="2">성 명</th><th>생년월일</th></tr>
      <tr><td colSpan="2" className="edi-center">{office.owner}</td><td className="edi-center">{office.birth}</td></tr>
      <tr className="edi-table-gap"><td colSpan="5"></td></tr>
      <tr><th rowSpan="5" className="edi-group">위탁<br />사업장</th><th>사업장관리번호</th><td>{f.management}</td><th>사업장 명칭</th><td>{f.company}</td></tr>
      <tr><th>소 재 지</th><td colSpan="3">{f.address}</td></tr>
      <tr><th>사업자등록번호</th><td>{f.business}</td><th>법인등록번호</th><td>{f.corporate}</td></tr>
      <tr><th rowSpan="2">사용자</th><th colSpan="2">성 명</th><th>생년월일</th></tr>
      <tr><td colSpan="2" className="edi-center">{f.owner}</td><td className="edi-center">{f.birth}</td></tr>
    </tbody></table>
    <div className="edi-scope"><b>업무위탁<br />범위</b><div>▪ 자격의 취득 및 상실 신고 · ▪ 내용변경 신고<br />▪ 기준소득월액 변경 등 신고 · ▪ 신고서 처리결과 및 보험료결정내역 확인<br />※ 증명서 발급에 관한 사항은 업무대행 범위에 포함되지 않음</div></div>
    <p className="edi-declaration">위탁사업장은 민법 제114조 규정에 따라 국민연금 웹 EDI 업무대행을 위탁하고, 업무대행기관은 대행기관으로서 제반 업무처리에 따른 법적 책임을 부담하며, 각 신청인은 개인정보의 부적정 사용을 방지하기 위한 조치를 취하고 불법 유출 등으로 발생하는 손해배상 등에 대하여 연대하여 책임질 것을 서약하며 업무대행을 신청합니다.</p>
    <p className="edi-date">{dateText(f.date)}</p>
    <Signature label="신청인(업무대행기관 사용자)" name={office.name} stamp={officeStamp ? stampUrl("pension") : ""} />
    <Signature label="신청인(업무대행 위탁사업장 사용자)" name={f.owner} stamp={clientStamp} size={stampSize} />
    <h2 className="edi-recipient">국민연금공단 {f.pensionBranch || "　　　　"} 지사장 귀하</h2>
    <footer><p>수수료 없음</p>210mm×297mm[일반용지 60g/㎡(재활용품)]</footer>
  </article>;
}
function Health({ form: f, clientStamp, stampSize }) {
  return <article className="edi-paper edi-health" aria-label="건강보험 위임장">
    <p className="edi-form-number">[별지 제6호 서식]</p>
    <h1>건강보험 EDI 업무대행 위임장</h1>
    <table><colgroup><col style={{ width: "5%" }} /><col style={{ width: "20%" }} /><col style={{ width: "22%" }} /><col style={{ width: "13%" }} /><col style={{ width: "40%" }} /></colgroup><tbody>
      <tr><th rowSpan="3" className="edi-vertical">업무대행기관</th><th>사업장관리번호</th><td>{office.management.replace(/\D/g, "")}</td><th>기 관 명</th><td className="edi-center">{office.name}</td></tr>
      <tr><th>소 재 지</th><td colSpan="3">{office.address}<br /><span className="edi-phone">(전화번호 : {office.phone})</span></td></tr>
      <tr><th>대표자 성명</th><td className="edi-center">{office.owner}</td><th>대표자<br />생년월일</th><td>{office.maskedBirth}</td></tr>
      <tr><th rowSpan="4" className="edi-vertical">위임사업장</th><th>사업장관리번호<br />(단위사업장기호)</th><td>{f.management}</td><th>사업장명</th><td className="edi-center">{f.company}</td></tr>
      <tr><th>소 재 지</th><td colSpan="3">{f.address}<br /><span className="edi-phone">(전화번호 : {office.phone})</span></td></tr>
      <tr><th>대표자 성명</th><td className="edi-center">{f.owner}</td><th>대표자<br />생년월일</th><td>{f.maskedBirth}</td></tr>
      <tr><th>사업자등록번호</th><td colSpan="3">{f.business}</td></tr>
      <tr><th colSpan="2">위임 업무범위</th><td colSpan="3"><b>공단 웹EDI 서비스 업무</b></td></tr>
    </tbody></table>
    <p className="edi-declaration">민법 제114조(대리행위의 효력)의 규정에 의하여 위와 같이 건강보험 EDI 업무대행 대리인 위임을 신청합니다.</p>
    <p className="edi-date">{dateText(f.date)}</p>
    <Signature label="위 임 자" name={f.owner} stamp={clientStamp} size={stampSize} />
    <h2 className="edi-recipient">국민건강보험공단 {f.healthBranch || "○○○○"}지사장 귀하</h2>
    <p className="edi-health-note">이 위임장은 웹EDI를 통하여 '건강보험 EDI 업무대행 위임 신청' 전송 시 첨부하는 서류입니다.</p>
  </article>;
}
function Labor({ form: f, clientStamp, officeStamp, stampSize }) {
  const coverage = <>{f.employment ? "☑" : "□"} 고용보험 {f.accident ? "☑" : "□"} 산업재해보상보험(임금채권 및 석면피해구제 포함)</>;
  return <article className="edi-paper edi-labor" aria-label="고용산재 사무위탁서">
    <p className="edi-form-number">[별지 제12호 서식] &lt;개정 2012. 2. 5.&gt;</p>
    <h1>보험사무대행기관 사무위탁서</h1>
    <table><colgroup><col style={{ width: "16%" }} /><col style={{ width: "20%" }} /><col style={{ width: "15%" }} /><col style={{ width: "21%" }} /><col style={{ width: "28%" }} /></colgroup><tbody>
      <tr><th>사업장관리번호</th><td>{f.management}</td><th>사업장명</th><td>{f.company}</td><td>상시사용근로자수 {f.workers}</td></tr>
      <tr><th>소재지</th><td colSpan="3">{f.address}</td><td>전화번호 {office.phone}</td></tr>
      <tr><th>대표자</th><td>{f.owner}</td><th>전화번호</th><td>{f.ownerPhone}</td><td>사업의 종류 {f.industry}</td></tr>
    </tbody></table>
    <h3 className="edi-labor-heading">위탁사항</h3>
    <div className="edi-labor-scope">
      <p>□ 고용보험 및 산업재해보상보험(임금채권 및 석면피해구제 포함)관련 사무</p>
      <ol><li>보수총액 및 근로자 고용정보 신고에 관한 사무</li><li>보험료 신고에 관한 사무</li><li>보험관계 성립, 변경, 소멸 등의 신고에 관한 사무</li><li>기타 관계 법령 및 규정 등에 의하여 사업주가 근로복지공단이나 지방고용노동관서에 신고 또는 보고하여야 할 보험사무</li><li>피보험자격의 취득·상실 및 근로내역확인 신고 등 피보험자관리에 관한 사무(고용보험에 한함)</li></ol>
      <p className="edi-consent">※ 보험사무대행기관이 상기 위탁사항의 처리에 필요한 정보를 근로복지공단에서 제공받는 것에 동의 함</p>
    </div>
    <table><tbody><tr><th>사무처리 시작 연월일</th><td>(예정)</td><td>{dateText(f.startDate)}</td></tr></tbody></table>
    <p className="edi-declaration">위와 같이 귀 보험사무대행기관에 {coverage} 사무의 처리를 위탁합니다.</p>
    <p className="edi-date">{dateText(f.date)}</p>
    <p className="edi-owner-address">위탁사업주 주소 {f.address}</p>
    <Signature label="성명" name={f.owner} stamp={clientStamp} size={stampSize} />
    <p className="edi-labor-recipient">{office.name} 보험사무대행기관 대표 귀하</p>
    <div className="edi-acceptance">
      <p>{coverage} 관련 사무 수탁을 ☑ 승낙 □ 불승낙 합니다.</p>
      <table><tbody><tr><th>불승낙 사유</th><td></td></tr><tr><th>보험가입자 사업장관리번호</th><td>{f.management}</td></tr></tbody></table>
      <p className="edi-date">{dateText(f.date)}</p>
      <dl><dt>보험사무대행기관 명칭</dt><dd>{office.name}</dd><dt>소재지</dt><dd>{office.laborAddress}</dd></dl>
      <Signature label="대표자" name={office.owner} stamp={officeStamp ? stampUrl("labor") : ""} />
      <p>{f.owner || "　　　　"} 귀하</p>
    </div>
    <footer>210mm×297mm[일반용지 60g/㎡(재활용품)]</footer>
  </article>;
}

export default function EdiApplication({ clients }) {
  const [form, setForm] = useState(blank);
  const [type, setType] = useState("pension");
  const [printAll, setPrintAll] = useState(false);
  const [officeStamp, setOfficeStamp] = useState(true);
  const [clientStamp, setClientStamp] = useState("");
  const [stampSize, setStampSize] = useState(16);
  const [error, setError] = useState("");
  const [previewScale, setPreviewScale] = useState(1);
  const preview = useRef(null);
  const uploadVersion = useRef(0);
  const fileInput = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setPreviewScale(Math.min(1, entry.contentRect.width / (210 * 96 / 25.4)));
    });
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, []);
  const options = useMemo(() => [...clients].sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "", "ko")), [clients]);
  const set = (key, value) => setForm((prev) => ({
    ...prev, [key]: value,
    ...(key === "business" ? { management: managementNumber(value) } : {}),
  }));
  function clearStamp() {
    uploadVersion.current += 1;
    setClientStamp("");
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function selectClient(id) {
    clearStamp();
    const c = clients.find((item) => String(item.id) === id);
    if (!c) { setForm(blank()); return; }
    const digits = (c.resident_number || "").replace(/\D/g, "");
    setForm({ ...blank(), clientId: id, company: c.company_name || "",
      business: c.business_number || c.business_reg_no || "",
      management: managementNumber(c.business_number || c.business_reg_no || ""),
      owner: c.owner_name || c.representative || "",
      address: c.address || "", ownerPhone: c.phone2 || c.phone || "",
      birth: digits.slice(0, 6), maskedBirth: digits.length >= 7 ? `${digits.slice(0, 6)}-${digits[6]}******` : digits.slice(0, 6),
    });
  }
  async function uploadStamp(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const version = ++uploadVersion.current;
    setError("");
    setClientStamp("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("5MB 이하의 PNG, JPG, WebP 도장 이미지를 선택해주세요.");
      event.target.value = "";
      return;
    }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await new Promise((resolve, reject) => {
        const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = data;
      });
      if (version === uploadVersion.current) setClientStamp(data);
    } catch {
      if (version === uploadVersion.current) setError("도장 이미지를 읽지 못했습니다. 다른 파일을 선택해주세요.");
    }
  }
  const props = { form, clientStamp, officeStamp, stampSize };
  return <div className={`edi-workspace${printAll ? " edi-print-all" : ""}`}>
    <section className="panel edi-editor no-print">
      <div className="panel-header"><h2>EDI 신청서 작성</h2><div className="edi-actions">
        <button type="button" className="secondary-button" onClick={() => { setForm(blank()); clearStamp(); }}>초기화</button>
        <button type="button" className="primary-button" onClick={() => window.print()}>인쇄 / PDF 저장</button>
      </div></div>
      <div className="edi-tabs" role="tablist" aria-label="신청서 종류">{Object.entries(types).map(([key, name]) => <button type="button" role="tab" id={`edi-tab-${key}`} aria-controls={`edi-page-${key}`} aria-selected={type === key} className={type === key ? "active" : ""} key={key} onClick={() => setType(key)}>{name}</button>)}</div>
      <div className="edi-input-grid">
        <Field label="거래처 선택" wide><select value={form.clientId} onChange={(e) => selectClient(e.target.value)}><option value="">직접 입력</option>{options.map((c) => <option key={c.id} value={String(c.id)}>{c.company_name}</option>)}</select></Field>
        <Field label="사업장명"><input value={form.company} onChange={(e) => set("company", e.target.value)} /></Field>
        <Field label="사업자등록번호"><input value={form.business} onChange={(e) => set("business", e.target.value)} /></Field>
        <Field label="사업장관리번호 / 단위사업장기호"><input value={form.management} onChange={(e) => set("management", e.target.value)} /></Field>
        <Field label="법인등록번호"><input value={form.corporate} onChange={(e) => set("corporate", e.target.value)} /></Field>
        <Field label="소재지" wide><input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="대표자 성명"><input value={form.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
        <Field label="대표자 생년월일 (국민연금)"><input value={form.birth} onChange={(e) => set("birth", e.target.value)} /></Field>
        <Field label="대표자 생년월일 (건강보험)"><input value={form.maskedBirth} onChange={(e) => set("maskedBirth", e.target.value)} /></Field>
        <Field label="사업장 전화번호"><input type="tel" value={office.phone} readOnly /></Field>
        <Field label="대표자 전화번호"><input type="tel" value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} /></Field>
        <Field label="상시사용근로자 수"><input type="number" min="0" step="1" value={form.workers} onChange={(e) => set("workers", e.target.value)} /></Field>
        <Field label="사업의 종류"><input value={form.industry} onChange={(e) => set("industry", e.target.value)} /></Field>
        <Field label="국민연금 수신 지사명"><input value={form.pensionBranch} onChange={(e) => set("pensionBranch", e.target.value)} /></Field>
        <Field label="건강보험 수신 지사명"><input value={form.healthBranch} onChange={(e) => set("healthBranch", e.target.value)} /></Field>
        <Field label="신청일"><input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="사무처리 시작일 (고용·산재)"><input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
      </div>
      <div className="edi-options">
        <label><input type="checkbox" checked={form.employment} onChange={(e) => set("employment", e.target.checked)} />고용보험</label>
        <label><input type="checkbox" checked={form.accident} onChange={(e) => set("accident", e.target.checked)} />산재보험</label>
        <label><input type="checkbox" checked={officeStamp} onChange={(e) => setOfficeStamp(e.target.checked)} />사무실 도장</label>
        <label><input type="checkbox" checked={printAll} onChange={(e) => setPrintAll(e.target.checked)} />3종 모두 인쇄</label>
      </div>
      <div className="edi-stamp-controls">
        <Field label="위임사업장 도장"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadStamp} /></Field>
        {clientStamp && <><img src={clientStamp} alt="위임사업장 도장 미리보기" /><Field label={`도장 크기 ${stampSize}mm`}><input type="range" min="10" max="24" value={stampSize} onChange={(e) => setStampSize(Number(e.target.value))} /></Field><button type="button" className="secondary-button" onClick={clearStamp}>도장 제거</button></>}
      </div>
      {error && <p role="alert" className="edi-error">{error}</p>}
      <div className="edi-office"><strong>업무대행기관</strong><span>{office.name} · {office.owner} · {office.business}</span><span>{office.address} · {office.phone}</span></div>
    </section>
    <div ref={preview} className="edi-previews" style={{ "--edi-preview-scale": previewScale }}>{Object.keys(types).map((key) => <div key={key} id={`edi-page-${key}`} role="tabpanel" aria-labelledby={`edi-tab-${key}`} className={`edi-page-slot${type === key ? " edi-selected" : ""}`}>
      {key === "pension" ? <Pension {...props} /> : key === "health" ? <Health {...props} /> : <Labor {...props} />}
    </div>)}</div>
  </div>;
}
