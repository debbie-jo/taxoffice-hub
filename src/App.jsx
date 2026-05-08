import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { Fragment, useCallback } from "react";
import "./index.css";

const bookkeepingTasks = [
  "세금계산서",
  "카드",
  "현금영수증",
  "통장",
  "부가세 분개",
  "급여분개",
  "4대보험 분개",
  "합잔 정리",
];

const taxFilingTypes = {
  withholding: {
    label: "원천세",
    description: "원천세 신고 대상 거래처",
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["급여자료", "신고서 작성", "납부서 전달"],
  },
  vat: {
    label: "부가세",
    description: "일반/간이 과세 거래처",
    applies: (client) => client.tax_type !== "면세사업자",
    tasks: ["자료", "전자신고", "납부서 전달"],
  },
  income: {
    label: "종합소득세",
    description: "개인 거래처",
    applies: (client) => client.entity_type === "개인",
    tasks: ["전자신고", "납부서 전달"],
  },
  corporate: {
    label: "법인세",
    description: "법인 거래처",
    applies: (client) => client.entity_type === "법인",
    tasks: ["전자신고", "납부서 전달"],
  },
};

const paymentStatementTypes = {
  business_simple: {
    label: "사업소득(간이)",
    periodType: "month",
    amountField: "business_income",
    aliases: ["사업소득", "사업", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  daily: {
    label: "일용직 지급명세서",
    periodType: "month",
    amountField: "daily_income",
    aliases: ["일용", "일용근로", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  earned_simple: {
    label: "근로소득(간이)",
    periodType: "half",
    amountField: "earned_income",
    aliases: ["근로", "근로소득", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  earned: {
    label: "근로",
    periodType: "year",
    amountField: "earned_income",
    aliases: ["근로", "근로소득", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  business: {
    label: "사업",
    periodType: "year",
    amountField: "business_income",
    aliases: ["사업", "사업소득", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  interest: {
    label: "이자",
    periodType: "year",
    amountField: "interest_income",
    aliases: ["이자", "이자소득", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  dividend: {
    label: "배당",
    periodType: "year",
    amountField: "dividend_income",
    aliases: ["배당", "배당소득", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  other: {
    label: "기타",
    periodType: "year",
    amountField: "other_income",
    aliases: ["기타", "기타소득", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
  retirement: {
    label: "퇴직",
    periodType: "year",
    amountField: "retirement_income",
    aliases: ["퇴직", "퇴직소득", "총지급액", "지급액"],
    applies: (client) => client.withholding_type !== "해당 없음",
    tasks: ["자료확인", "작성", "전자제출", "접수확인"],
  },
};

const sharedStateConfigs = [
  { key: "bookkeepingProgress", fallback: {} },
  { key: "taxFilingProgress", fallback: {} },
  { key: "correctionFilings", fallback: [] },
  { key: "reviewUploads", fallback: { rows: [], uploadMode: "amount" } },
  { key: "statementUploads", fallback: { rows: [] } },
  { key: "incomeReportNotes", fallback: {} },
  { key: "incomeReportUploads", fallback: {} },
  { key: "incomeReportSavedReports", fallback: {} },
  { key: "incomeExpenseRates", fallback: [] },
];

const withholdingAmountFields = [
  { key: "earned_income", label: "근로", placeholder: "0" },
  { key: "business_income", label: "사업", placeholder: "0" },
  { key: "daily_income", label: "일용", placeholder: "0" },
  { key: "interest_income", label: "이자", placeholder: "0" },
  { key: "dividend_income", label: "배당", placeholder: "0" },
  { key: "other_income", label: "기타", placeholder: "0" },
  { key: "retirement_income", label: "퇴직", placeholder: "0" },
];

const withholdingTaxFields = [
  { key: "income_tax", label: "소득세", placeholder: "0" },
  { key: "local_tax", label: "지방세", placeholder: "0" },
];

const vatAmountFields = [
  { key: "tax_base", label: "과세표준", placeholder: "0" },
  { key: "pre_notice", label: "예정고지", placeholder: "0" },
  { key: "payment_tax", label: "납부액", placeholder: "0" },
];

const vatPeriods = ["1기 예정", "1기 확정", "2기 예정", "2기 확정"];

const incomeFilingTypes = ["복식", "간편", "단순"];

const incomeAmountFields = [
  { key: "income_amount", label: "소득금액", placeholder: "0" },
  { key: "pre_notice", label: "예정고지", placeholder: "0" },
  { key: "global_income_tax", label: "종합소득세", placeholder: "0" },
  { key: "local_income_tax", label: "지방소득세", placeholder: "0" },
  { key: "rural_tax", label: "농특세", placeholder: "0" },
  { key: "adjustment_fee", label: "조정료", placeholder: "0" },
];

const corporateAmountFields = [
  { key: "tax_base", label: "과세표준", placeholder: "0" },
  { key: "income_amount", label: "소득금액", placeholder: "0" },
  { key: "pre_notice", label: "예정고지", placeholder: "0" },
  { key: "corporate_tax", label: "법인세", placeholder: "0" },
  { key: "corporate_local_tax", label: "법인지방세", placeholder: "0" },
  { key: "rural_tax", label: "농특세", placeholder: "0" },
  { key: "adjustment_fee", label: "조정료", placeholder: "0" },
];

const corporatePrepayFields = [
  { key: "prepayment_tax", label: "중간예납세액", placeholder: "0" },
];

const reviewFieldConfigs = {
  withholding: [
    { key: "total_payment", label: "총지급액", aliases: ["총지급액", "총 지급액", "지급액", "과세대상급여", "총급여액"] },
    { key: "income_tax", label: "소득세", aliases: ["소득세", "소득세 등 납부세액", "원천세", "국세", "납부세액", "납부할세액", "총납부세액", "차가감납부세액", "차가감납부할세액"] },
  ],
  vat: [
    { key: "tax_base", label: "과세표준", aliases: ["과세표준", "과표", "공급가액", "매출과세표준"] },
    { key: "pre_notice", label: "예정고지", aliases: ["예정고지", "예정고지세액"] },
    { key: "payment_tax", label: "납부액", aliases: ["납부액", "납부세액", "납부할세액", "총납부세액", "차가감납부세액", "차가감납부할세액", "환급세액"] },
  ],
  income: [
    { key: "global_income_tax", label: "종합소득세", aliases: ["종합소득세", "소득세", "국세", "결정세액", "납부세액", "납부할세액", "총납부세액"] },
    { key: "local_income_tax", label: "지방소득세", aliases: ["지방소득세", "지방세", "지방소득세액", "지방세액"] },
    { key: "rural_tax", label: "농특세", aliases: ["농특세", "농어촌특별세"] },
  ],
  corporate: [
    { key: "corporate_tax", label: "법인세", aliases: ["법인세", "국세", "결정세액", "납부세액", "납부할세액", "총납부세액"] },
    { key: "corporate_local_tax", label: "법인지방세", aliases: ["법인지방세", "지방세", "지방소득세", "지방소득세액", "지방세액"] },
    { key: "rural_tax", label: "농특세", aliases: ["농특세", "농어촌특별세"] },
  ],
};

const emptyCorrectionForm = {
  company_name: "",
  filing_kind: "부가세",
  period: "",
  reason: "",
  tax_difference: "",
  local_tax_difference: "",
  efile_done: false,
  payment_notice_done: false,
  status: "진행",
  memo: "",
};

const emptyForm = {
  company_name: "",
  business_number: "",
  resident_number: "",
  owner_name: "",
  phone: "",
  phone2: "",
  email: "",
  is_joint_business: false,
  joint_share_ratio: "",
  joint_owner_name: "",
  joint_resident_number: "",
  joint_start_date: "",
  joint_end_date: "",
  memo: "",
  entity_type: "개인",
  tax_type: "일반과세자",
  withholding_type: "반기",
  agency_type: "기장대리",
  bookkeeping_fee: "",
  contract_date: "",
  end_date: "",
  status: "계속",
};

function normalizeClient(client) {
  return {
    company_name: client.company_name || "",
    business_number: client.business_number || client.business_reg_no || "",
    resident_number: client.resident_number || "",
    owner_name: client.owner_name || client.representative || "",
    phone: client.phone || "",
    phone2: client.phone2 || "",
    email: client.email || "",
    is_joint_business: Boolean(client.is_joint_business),
    joint_share_ratio: client.joint_share_ratio ?? "",
    joint_owner_name: client.joint_owner_name || "",
    joint_resident_number: client.joint_resident_number || "",
    joint_start_date: client.joint_start_date || "",
    joint_end_date: client.joint_end_date || "",
    memo: client.memo || "",
    entity_type: client.entity_type || client.filing_type || "개인",
    tax_type: client.tax_type || "일반과세자",
    withholding_type: client.withholding_type || "반기",
    agency_type: client.agency_type || "기장대리",
    bookkeeping_fee: client.bookkeeping_fee ?? "",
    contract_date: client.contract_date || "",
    end_date: client.end_date || "",
    status: client.status || "계속",
  };
}

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatBusinessNumber(value) {
  const digits = onlyDigits(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatResidentNumber(value) {
  const digits = onlyDigits(value).slice(0, 13);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
}

function formatNumberWithCommas(value) {
  const digits = onlyDigits(value);
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

function formatSignedNumberWithCommas(value) {
  const text = String(value ?? "").trim();
  const negative = text.startsWith("-");
  const formatted = formatNumberWithCommas(text);
  return formatted ? `${negative ? "-" : ""}${formatted}` : negative ? "-" : "";
}

function toNumber(value) {
  const cleaned = String(value ?? "").replaceAll(",", "");
  return Number(cleaned) || 0;
}

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "-" : Number(value).toLocaleString("ko-KR");
}

function getReviewStatusClass(status) {
  if (["일치", "접수 확인"].includes(status)) return "review-ok";
  if (status === "차이") return "review-diff";
  if (status === "홈택스 없음") return "review-missing-status";
  return "review-muted";
}

function formatField(name, value) {
  if (name === "business_number") return formatBusinessNumber(value);
  if (["resident_number", "joint_resident_number"].includes(name)) return formatResidentNumber(value);
  if (["phone", "phone2"].includes(name)) return formatPhone(value);
  if (["bookkeeping_fee", "joint_share_ratio"].includes(name)) return formatNumberWithCommas(value);
  return value;
}

function valueLabel(value) {
  if (typeof value === "boolean") return value ? "여" : "부";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function splitCsvRecords(text) {
  const records = [];
  let current = "";
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += char + next;
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
      current += char;
    } else if (char === "\n" && !quoted) {
      if (current.trim()) records.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) records.push(current);
  return records;
}

function parseCsv(text) {
  const records = splitCsvRecords(text);
  if (records.length < 2) return [];

  const headers = splitCsvLine(records[0]).map((header) => header.trim());
  return records.slice(1).map((record) => {
    const values = splitCsvLine(record);
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index]?.trim() || "" }), {});
  });
}

function normalizeHeaderName(value) {
  return String(value ?? "").replace(/[\s()[\]{}·._-]/g, "").toLowerCase();
}

function rowsToObjects(rows) {
  const cleanRows = rows
    .map((row) => row.map((cell) => String(cell ?? "").replace(/\s+/g, " ").trim()))
    .filter((row) => row.some(Boolean));

  if (cleanRows.length < 2) return [];

  const headerWords = [
    "업체",
    "상호",
    "성명",
    "납세자",
    "사업자",
    "주민",
    "소득세",
    "지방세",
    "납부",
    "과세",
    "세액",
    "소득",
    "농특세",
    "업종",
    "업태",
    "중분류",
    "세분류",
    "경비율",
    "귀속연도",
    "기준",
  ];

  const headerIndex = cleanRows.reduce((best, row, index) => {
    const score = row.reduce((sum, cell) => sum + (headerWords.some((word) => cell.includes(word)) ? 1 : 0), 0);
    if (score > best.score) return { index, score };
    return best;
  }, { index: 0, score: 0 }).index;

  const headers = cleanRows[headerIndex].map((header, index) => header || `열${index + 1}`);
  return cleanRows.slice(headerIndex + 1).map((row) =>
    headers.reduce((item, header, index) => ({ ...item, [header]: row[index] || "", [`__col${index}`]: row[index] || "" }), {}),
  );
}

function parseDelimitedText(text) {
  const records = splitCsvRecords(text);
  if (records.length < 2) return [];
  const delimiter = records[0].includes("\t") ? "\t" : ",";
  const rows = records.map((record) => (delimiter === "\t" ? record.split("\t") : splitCsvLine(record)));
  return rowsToObjects(rows);
}

function parseHtmlTable(text) {
  const document = new DOMParser().parseFromString(text, "text/html");
  const tables = Array.from(document.querySelectorAll("table"));
  const table = tables.sort((a, b) => b.querySelectorAll("tr").length - a.querySelectorAll("tr").length)[0];
  if (!table) return [];

  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th, td")).map((cell) => cell.textContent.trim()),
  );
  return rowsToObjects(rows);
}

function parseXmlSpreadsheet(text) {
  const document = new DOMParser().parseFromString(text, "text/xml");
  if (document.querySelector("parsererror")) return [];

  const rows = Array.from(document.getElementsByTagName("Row")).map((row) => {
    const cells = [];
    Array.from(row.getElementsByTagName("Cell")).forEach((cell) => {
      const indexAttr = cell.getAttribute("ss:Index") || cell.getAttribute("Index");
      const targetIndex = indexAttr ? Number(indexAttr) - 1 : cells.length;
      cells[targetIndex] = cell.getElementsByTagName("Data")[0]?.textContent.trim() || "";
    });
    return cells;
  });

  return rowsToObjects(rows);
}

function getColumnIndex(reference) {
  const letters = String(reference || "").match(/[A-Z]+/)?.[0] || "";
  return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseBiffString(view, offset) {
  const length = view.getUint16(offset, true);
  let position = offset + 2;
  const flags = view.getUint8(position);
  position += 1;
  const isWide = Boolean(flags & 1);
  const hasExt = Boolean(flags & 4);
  const hasRich = Boolean(flags & 8);
  let richRuns = 0;
  let extLength = 0;

  if (hasRich) {
    richRuns = view.getUint16(position, true);
    position += 2;
  }
  if (hasExt) {
    extLength = view.getUint32(position, true);
    position += 4;
  }

  const byteLength = length * (isWide ? 2 : 1);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + position, byteLength);
  const value = new TextDecoder(isWide ? "utf-16le" : "latin1").decode(bytes);
  position += byteLength + richRuns * 4 + extLength;
  return { value, position };
}

function parseBiffRk(value) {
  let number;
  if (value & 2) {
    number = value >> 2;
  } else {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, value & 0xfffffffc, true);
    number = view.getFloat64(0, true);
  }
  return value & 1 ? number / 100 : number;
}

function readOleChain(bytes, fat, sectorSize, start) {
  const chunks = [];
  let sector = start;
  let guard = 0;

  while (sector < 0xfffffff0 && guard < 10000) {
    const offset = (sector + 1) * sectorSize;
    chunks.push(bytes.slice(offset, offset + sectorSize));
    sector = fat[sector];
    guard += 1;
  }

  const size = chunks.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function parseBinaryXlsRows(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const sectorSize = 1 << view.getUint16(30, true);
  const firstDirectorySector = view.getUint32(48, true);
  const fatSectors = [];

  for (let index = 0; index < 109; index += 1) {
    const sector = view.getUint32(76 + index * 4, true);
    if (sector < 0xfffffff0) fatSectors.push(sector);
  }

  const fat = [];
  fatSectors.forEach((sector) => {
    const offset = (sector + 1) * sectorSize;
    for (let index = 0; index < sectorSize / 4; index += 1) {
      fat.push(view.getUint32(offset + index * 4, true));
    }
  });

  const directory = readOleChain(bytes, fat, sectorSize, firstDirectorySector);
  const directoryView = new DataView(directory.buffer);
  let workbookEntry = null;

  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = directoryView.getUint16(offset + 64, true);
    if (!nameLength) continue;

    const nameBytes = directory.slice(offset, offset + nameLength - 2);
    const name = new TextDecoder("utf-16le").decode(nameBytes);
    if (!/Workbook|Book/i.test(name)) continue;

    workbookEntry = {
      start: directoryView.getUint32(offset + 116, true),
      size: Number(directoryView.getBigUint64(offset + 120, true)),
    };
    break;
  }

  if (!workbookEntry) return [];

  const workbook = readOleChain(bytes, fat, sectorSize, workbookEntry.start).slice(0, workbookEntry.size);
  const workbookView = new DataView(workbook.buffer);
  const records = [];

  for (let offset = 0; offset + 4 <= workbook.length;) {
    const id = workbookView.getUint16(offset, true);
    const length = workbookView.getUint16(offset + 2, true);
    records.push({ id, offset: offset + 4, length });
    offset += 4 + length;
  }

  const sharedStrings = [];
  records.forEach((record) => {
    if (record.id !== 0x00fc) return;
    if (record.offset + record.length > workbook.length) return;

    const bodyView = new DataView(workbook.buffer, record.offset, record.length);
    let position = 8;
    while (position < record.length - 2) {
      try {
        const item = parseBiffString(bodyView, position);
        sharedStrings.push(item.value);
        position = item.position;
      } catch {
        break;
      }
    }
  });

  const rows = [];
  const setCell = (row, column, value) => {
    if (!rows[row]) rows[row] = [];
    rows[row][column] = value;
  };

  records.forEach((record) => {
    if (record.offset + record.length > workbook.length) return;
    const bodyView = new DataView(workbook.buffer, record.offset, record.length);
    if (record.id === 0x00fd) {
      setCell(bodyView.getUint16(0, true), bodyView.getUint16(2, true), sharedStrings[bodyView.getUint32(6, true)] || "");
    } else if (record.id === 0x0203) {
      setCell(bodyView.getUint16(0, true), bodyView.getUint16(2, true), bodyView.getFloat64(6, true));
    } else if (record.id === 0x027e) {
      setCell(bodyView.getUint16(0, true), bodyView.getUint16(2, true), parseBiffRk(bodyView.getUint32(6, true)));
    } else if (record.id === 0x00bd) {
      const row = bodyView.getUint16(0, true);
      const firstColumn = bodyView.getUint16(2, true);
      const lastColumn = bodyView.getUint16(4, true);
      let position = 6;
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        position += 2;
        setCell(row, column, parseBiffRk(bodyView.getUint32(position, true)));
        position += 4;
      }
    } else if (record.id === 0x0204) {
      const row = bodyView.getUint16(0, true);
      const column = bodyView.getUint16(2, true);
      const length = bodyView.getUint16(6, true);
      const bytes = new Uint8Array(workbook.buffer, record.offset + 8, length);
      setCell(row, column, new TextDecoder("latin1").decode(bytes));
    }
  });

  return rowsToObjects(rows);
}

function readXmlText(document, selector) {
  return document.querySelector(selector)?.textContent || "";
}

async function inflateDeflateRaw(data) {
  if (!("DecompressionStream" in window)) {
    throw new Error("이 브라우저에서는 xlsx 압축을 바로 풀 수 없습니다. 홈택스 파일을 CSV 또는 Excel 97-2003(.xls)로 저장해서 올려주세요.");
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocdOffset = -1;

  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66000); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error("xlsx 파일 구조를 읽지 못했습니다.");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? await inflateDeflateRaw(compressed) : null;

    if (data) entries.set(name, new TextDecoder("utf-8").decode(data));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function parseXlsx(buffer) {
  const entries = await readZipEntries(buffer);
  const sharedDocument = new DOMParser().parseFromString(entries.get("xl/sharedStrings.xml") || "<sst />", "text/xml");
  const sharedStrings = Array.from(sharedDocument.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t")).map((text) => text.textContent).join(""),
  );
  const worksheetName = Array.from(entries.keys()).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!worksheetName) return [];

  const document = new DOMParser().parseFromString(entries.get(worksheetName), "text/xml");
  const rows = Array.from(document.getElementsByTagName("row")).map((row) => {
    const cells = [];
    Array.from(row.getElementsByTagName("c")).forEach((cell) => {
      const reference = cell.getAttribute("r") || "";
      const columnIndex = getColumnIndex(reference);
      const value = readXmlText(cell, "v");
      cells[columnIndex >= 0 ? columnIndex : cells.length] = cell.getAttribute("t") === "s" ? sharedStrings[Number(value)] || "" : value;
    });
    return cells;
  });

  return rowsToObjects(rows);
}

async function parseUploadedRows(file) {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    try {
      const rows = parseBinaryXlsRows(buffer);
      if (rows.length > 0) return rows;
    } catch {
      // xls 파싱 실패 시 xlsx로 재시도
    }
  }

  if (name.endsWith(".xlsx") || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    return parseXlsx(buffer);
  }

  const text = decodeCsv(buffer);
  const trimmed = text.trimStart().toLowerCase();
  if (trimmed.startsWith("<html") || trimmed.includes("<table")) return parseHtmlTable(text);
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<workbook")) return parseXmlSpreadsheet(text);
  return parseDelimitedText(text);
}

function decodeCsv(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("�")) return utf8;

  try {
    return new TextDecoder("euc-kr").decode(buffer);
  } catch {
    return utf8;
  }
}

function getCsvValue(row, names) {
  const keys = Array.isArray(names) ? names : [names];
  const key = keys.find((name) => row[name] !== undefined);
  if (key) return row[key];

  const normalizedEntries = Object.entries(row).map(([name, value]) => [normalizeHeaderName(name), value]);
  const normalizedRow = normalizedEntries.reduce((items, [name, value]) => ({ ...items, [name]: value }), {});
  const normalizedKey = keys.find((name) => normalizedRow[normalizeHeaderName(name)] !== undefined);
  if (normalizedKey) return normalizedRow[normalizeHeaderName(normalizedKey)];

  const fuzzyKey = keys.find((name) => {
    const normalizedName = normalizeHeaderName(name);
    return normalizedName && normalizedEntries.some(([header]) => header.includes(normalizedName) || normalizedName.includes(header));
  });
  if (fuzzyKey) {
    const normalizedName = normalizeHeaderName(fuzzyKey);
    const entry = normalizedEntries.find(([header]) => header.includes(normalizedName) || normalizedName.includes(header));
    return entry?.[1] || "";
  }

  return "";
}

function normalizeStatus(value) {
  if (value === "활성" || value === "active") return "계속";
  if (["계속", "휴업", "폐업", "이관"].includes(value)) return value;
  return "계속";
}

function normalizeWithholdingType(value) {
  if (value.includes("월")) return "매월";
  if (value.includes("반기")) return "반기";
  return value || "해당 없음";
}

function normalizeTaxType(value) {
  if (value.includes("간이")) return "간이과세자";
  if (value.includes("면세")) return "면세사업자";
  return "일반과세자";
}

function normalizeAgencyType(value) {
  if (value.includes("신고")) return "신고대리";
  return "기장대리";
}

function getStatusOrder(status) {
  return { 계속: 0, 휴업: 1, 폐업: 2, 이관: 3 }[status] ?? 4;
}

function getEntityOrder(entityType) {
  return entityType === "법인" ? 0 : entityType === "개인" ? 1 : 2;
}

function getWithholdingOrder(withholdingType) {
  return { 매월: 0, 반기: 1, "해당 없음": 2 }[withholdingType] ?? 3;
}

function sortClients(a, b) {
  const left = normalizeClient(a);
  const right = normalizeClient(b);
  return (
    getStatusOrder(left.status) - getStatusOrder(right.status) ||
    getEntityOrder(left.entity_type) - getEntityOrder(right.entity_type) ||
    left.company_name.localeCompare(right.company_name, "ko-KR", { numeric: true })
  );
}

function normalizeDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dotted = text.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (dotted) {
    const [, year, month, day] = dotted;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d+$/.test(text)) {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + Number(text));
    return base.toISOString().slice(0, 10);
  }
  return "";
}

function buildClientPayload(source, useSecondPhone = true) {
  return {
    ...source,
    business_reg_no: source.business_number,
    representative: source.owner_name,
    filing_type: source.entity_type,
    phone2: useSecondPhone ? source.phone2 : "",
    bookkeeping_fee: source.bookkeeping_fee ? Number(String(source.bookkeeping_fee).replaceAll(",", "")) : null,
    joint_share_ratio: source.joint_share_ratio ? Number(String(source.joint_share_ratio).replaceAll(",", "")) : null,
    joint_owner_name: source.joint_owner_name || "",
    joint_resident_number: source.joint_resident_number || "",
    joint_start_date: source.joint_start_date || null,
    joint_end_date: source.joint_end_date || null,
    contract_date: source.contract_date || null,
    end_date: source.end_date || null,
  };
}

function mapImportRow(row) {
  const agencyType =
    getCsvValue(row, ["대리유형", "agency_type"]) ||
    (getCsvValue(row, "기장대리 여부").includes("여")
      ? "기장대리"
      : getCsvValue(row, "신고대리 여부").includes("여")
        ? "신고대리"
        : "");

  const memoParts = [
    ["담당자", getCsvValue(row, "담당자명")],
    ["부가세", getCsvValue(row, "메모 (부가세)")],
    ["법인/소득", getCsvValue(row, "메모 (법인/소득)")],
    ["원천세", getCsvValue(row, "메모 (원천세)")],
    ["특이사항", getCsvValue(row, "특이사항")],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  return {
    ...emptyForm,
    company_name: getCsvValue(row, ["업체명", "company_name"]),
    business_number: formatBusinessNumber(getCsvValue(row, ["사업자번호", "business_number"])),
    resident_number: formatResidentNumber(getCsvValue(row, ["주민번호", "주민번호 (개인)", "resident_number"])),
    owner_name: getCsvValue(row, ["대표자명", "owner_name"]),
    phone: formatPhone(getCsvValue(row, ["연락처", "phone"])),
    phone2: formatPhone(getCsvValue(row, ["연락처2", "phone2"])),
    email: getCsvValue(row, ["메일주소", "email"]),
    entity_type: getCsvValue(row, ["법인/개인", "entity_type"]) || "개인",
    tax_type: normalizeTaxType(getCsvValue(row, ["과세유형", "과세 유형", "tax_type"])),
    withholding_type: normalizeWithholdingType(getCsvValue(row, ["원천세 신고유형", "withholding_type"])),
    agency_type: normalizeAgencyType(agencyType),
    bookkeeping_fee: formatNumberWithCommas(getCsvValue(row, ["기장료", "bookkeeping_fee"])),
    contract_date: normalizeDate(getCsvValue(row, ["계약일", "contract_date"])),
    end_date: normalizeDate(getCsvValue(row, ["종료일", "기장 종료일", "end_date"])),
    status: normalizeStatus(getCsvValue(row, ["상태", "status"])),
    memo: memoParts.join("\n"),
  };
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

function getYearOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, index) => String(current + 1 - index));
}

function getReviewPeriodKey(type, year, month, period, mode) {
  if (type === "vat") return `${year} ${period}`;
  if (type === "income") return `${year} 귀속`;
  if (type === "corporate") return `${year} ${mode}`;
  return month;
}

function getPaymentStatementPeriodKey(type, month, year, half) {
  const item = paymentStatementTypes[type];
  if (item?.periodType === "month") return month;
  if (item?.periodType === "half") return `${year} ${half}`;
  return `${year} 귀속`;
}

function getStatementSourceMonths(type, month, year, half) {
  const item = paymentStatementTypes[type];
  if (item?.periodType === "month") return [month];
  if (item?.periodType === "half") {
    const months = half === "상반기" ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
    return months.map((item) => `${year}-${String(item).padStart(2, "0")}`);
  }
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function isSemiannualReviewMonth(month) {
  const reviewMonth = String(month || "").slice(-2);
  return reviewMonth === "01" || reviewMonth === "07";
}

function getUploadIdentifier(row) {
  return {
    company_name: getCsvValue(row, ["업체명", "상호", "상호명", "상호(성명)", "회사명", "성명", "납세자명"]),
    business_number: formatBusinessNumber(getCsvValue(row, ["사업자번호", "사업자등록번호", "사업자(주민)등록번호", "등록번호"])),
    resident_number: formatResidentNumber(getCsvValue(row, ["주민번호", "주민등록번호", "사업자(주민)등록번호"])),
  };
}

function readLocalState(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function hasStateValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function bytesToBinary(bytes) {
  let result = "";
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return result;
}

async function inflatePdfChunk(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("이 브라우저에서는 PDF 압축 해제를 지원하지 않습니다. 최신 크롬이나 엣지에서 다시 시도해주세요.");
  }

  const formats = ["deflate", "deflate-raw"];
  let lastError = null;

  for (const format of formats) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("PDF 압축을 풀지 못했습니다.");
}

function decodePdfHex(hex, cmap) {
  let value = "";
  const cleanHex = hex.replace(/\s/g, "").toUpperCase();

  for (let index = 0; index < cleanHex.length; index += 4) {
    value += cmap[cleanHex.slice(index, index + 4)] || "";
  }

  return value;
}

function parsePdfCMap(text) {
  const cmap = {};
  const blocks = text.match(/beginbfchar[\s\S]*?endbfchar/g) || [];

  blocks.forEach((block) => {
    [...block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)].forEach(([, source, target]) => {
      let value = "";
      for (let index = 0; index < target.length; index += 4) {
        value += String.fromCodePoint(parseInt(target.slice(index, index + 4), 16));
      }
      cmap[source.toUpperCase()] = value;
    });
  });

  return cmap;
}

async function extractPdfText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const binary = bytesToBinary(bytes);
  const streams = [];
  let position = 0;

  while (position < binary.length) {
    const streamIndex = binary.indexOf("stream", position);
    if (streamIndex < 0) break;

    let start = streamIndex + 6;
    if (binary[start] === "\r" && binary[start + 1] === "\n") start += 2;
    else if (binary[start] === "\n") start += 1;

    const endStreamIndex = binary.indexOf("endstream", start);
    if (endStreamIndex < 0) break;

    let end = endStreamIndex;
    if (binary[end - 2] === "\r" && binary[end - 1] === "\n") end -= 2;
    else if (binary[end - 1] === "\n") end -= 1;

    try {
      streams.push(await inflatePdfChunk(bytes.subarray(start, end)));
    } catch {
      // Some streams can be images or unsupported filters. Text streams are handled when possible.
    }

    position = endStreamIndex + 9;
  }

  const streamText = streams.map((stream) => bytesToBinary(stream)).join("\n");
  const cmap = parsePdfCMap(streamText);
  const parts = [];

  [...streamText.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)].forEach(([, hex]) => {
    const value = decodePdfHex(hex, cmap);
    if (value) parts.push(value);
  });

  [...streamText.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)].forEach(([, block]) => {
    let value = "";
    [...block.matchAll(/<([0-9A-Fa-f\s]+)>/g)].forEach(([, hex]) => {
      value += decodePdfHex(hex, cmap);
    });
    if (value) parts.push(value);
  });

  if (parts.length === 0) {
    throw new Error("PDF에서 신고서 텍스트를 찾지 못했습니다. 스캔본이 아닌 홈택스 전자신고 PDF인지 확인해주세요.");
  }

  return parts.join("");
}

function extractNumberAfter(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return formatSignedNumberWithCommas(match[1]);
  }
  return "";
}

function extractNumbersBetween(text, startLabel, endLabel) {
  const start = text.indexOf(startLabel);
  if (start < 0) return [];
  const end = text.indexOf(endLabel, start + startLabel.length);
  const section = text.slice(start + startLabel.length, end > start ? end : undefined);
  return (section.match(/-?\d{1,3}(?:,\d{3})+/g) || []).map(toNumber);
}

function sumNumbers(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

function parseRateValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function normalizeExpenseRateRow(row) {
  const code = onlyDigits(getCsvValue(row, ["업종코드", "업 종 코 드", "코드", "업종 코드", "업종"])).slice(0, 6);
  if (!code || code.length !== 6) return null;

  function scanColumn(predicate) {
    const entry = Object.entries(row).find(([key, val]) => {
      if (key.startsWith("__col")) return false;
      const norm = normalizeHeaderName(key);
      return norm && predicate(norm) && parseRateValue(val) > 0;
    });
    return entry ? parseRateValue(entry[1]) : 0;
  }

  // 단순경비율(일반) — 헤더에 "단순"+"일반" 포함, 없으면 H열(col7) 폴백
  const simpleRate =
    scanColumn((h) => h.includes("단순") && h.includes("일반")) ||
    scanColumn((h) => h.includes("단순경비율") || h.includes("단순율")) ||
    parseRateValue(row["__col7"]);

  // 기준경비율(일반) — "기준"+"일반" 포함이되 "단순" 제외
  const standardRate =
    scanColumn((h) => h.includes("기준") && h.includes("일반") && !h.includes("단순")) ||
    scanColumn((h) => h.includes("기준경비율") && !h.includes("단순"));

  const industryName = getCsvValue(row, ["세분류", "업종명", "업 종 명", "세세분류", "업태명", "종목명"]);

  return {
    code,
    industryName,
    detailName: getCsvValue(row, ["세세분류", "적용기준내용"]),
    simpleRate,
    standardRate,
    referenceIncomeRate: simpleRate ? Math.max(0, 100 - simpleRate) : 0,
  };
}

function parseIncomeTaxReportFromPdfText(text) {
  const compactText = text.replace(/\s+/g, "");
  const industryCodeSectionStart = compactText.indexOf("⑧주업종코드");
  const industryCodeSectionEnd = compactText.indexOf("⑨총수입금액", industryCodeSectionStart);
  const industryCodeSection = industryCodeSectionStart >= 0
    ? compactText.slice(industryCodeSectionStart, industryCodeSectionEnd > industryCodeSectionStart ? industryCodeSectionEnd : undefined)
    : "";
  const industryCodes = Array.from(new Set(industryCodeSection.match(/\d{6}/g) || []));
  const revenues = extractNumbersBetween(compactText, "⑨총수입금액", "⑩필요경비");
  const expenses = extractNumbersBetween(compactText, "⑩필요경비", "⑪소득금액");
  const incomes = extractNumbersBetween(compactText, "⑪소득금액(⑨-⑩)", "⑫과세기간");
  const businessRows = industryCodes.map((code, index) => ({
    code,
    revenue: revenues[index] || 0,
    expense: expenses[index] || 0,
    income: incomes[index] || 0,
  })).filter((row) => row.revenue || row.expense || row.income);
  const revenueTotal = sumNumbers(businessRows.map((row) => row.revenue));
  const expenseTotal = sumNumbers(businessRows.map((row) => row.expense));
  const businessIncomeTotal = sumNumbers(businessRows.map((row) => row.income));
  const taxpayerName =
    [...compactText.matchAll(/신고인([가-힣]{2,8})\(서명또는인\)/g)]
      .map((match) => match[1])
      .find((name) => name.length <= 5) || "";

  return {
    source: "pdf",
    taxpayerName,
    industryCodes,
    businessRows,
    revenueTotal: revenueTotal ? formatSignedNumberWithCommas(revenueTotal) : "",
    expenseTotal: expenseTotal ? formatSignedNumberWithCommas(expenseTotal) : "",
    businessIncomeTotal: businessIncomeTotal ? formatSignedNumberWithCommas(businessIncomeTotal) : "",
    totalIncome: extractNumberAfter(compactText, [/종합소득금액(-?\d{1,3}(?:,\d{3})*)/]),
    incomeDeduction: extractNumberAfter(compactText, [/소득공제(-?\d{1,3}(?:,\d{3})*)/]),
    taxBase: extractNumberAfter(compactText, [/과세표준\(-\)(-?\d{1,3}(?:,\d{3})*)/]),
    taxRate: compactText.match(/세율([0-9.]+%)/)?.[1] || "",
    calculatedTax: extractNumberAfter(compactText, [/산출세액(-?\d{1,3}(?:,\d{3})*)/]),
    taxCredit: (() => {
      const reduction = toNumber(compactText.match(/세액감면(\d{1,3}(?:,\d{3})+)/)?.[1] || "0");
      const credit = toNumber(compactText.match(/세액공제(\d{1,3}(?:,\d{3})+)/)?.[1] || "0");
      const total = reduction + credit;
      return total > 0 ? formatSignedNumberWithCommas(String(total)) : "";
    })(),
    determinedTax: extractNumberAfter(compactText, [/결정세액종합과세\([^)]+\)(-?\d{1,3}(?:,\d{3})*)/]),
    prepaidTax: extractNumberAfter(compactText, [/기납부세액(-?\d{1,3}(?:,\d{3})*)/]),
    payableTax: extractNumberAfter(compactText, [/납부\(환급\)할총세액\(-\)(-?\d{1,3}(?:,\d{3})*)/]),
    dueTax: extractNumberAfter(compactText, [/신고기한내납부할세액\([^)]+\)(-?\d{1,3}(?:,\d{3})*)/]),
    ruralTax: extractNumberAfter(compactText, [/농어촌특별세(-?\d{1,3}(?:,\d{3})*)/, /농특세(-?\d{1,3}(?:,\d{3})*)/]),
  };
}

// 세무사 보수표 별표2 조정수수료 자동계산
function isCurrentTier(revenue, range) {
  const r = Number(revenue) || 0;
  if (range === "1억 미만") return r > 0 && r < 100_000_000;
  if (range === "1억 ~ 3억") return r >= 100_000_000 && r < 300_000_000;
  if (range === "3억 ~ 5억") return r >= 300_000_000 && r < 500_000_000;
  if (range === "5억 ~ 10억") return r >= 500_000_000 && r < 1_000_000_000;
  if (range === "10억 ~ 30억") return r >= 1_000_000_000 && r < 3_000_000_000;
  if (range === "30억 ~ 50억") return r >= 3_000_000_000 && r < 5_000_000_000;
  if (range === "50억 ~ 100억") return r >= 5_000_000_000 && r < 10_000_000_000;
  if (range === "100억 ~ 500억") return r >= 10_000_000_000 && r < 50_000_000_000;
  if (range === "500억 이상") return r >= 50_000_000_000;
  return false;
}

function calculateAdjustmentFee(revenue) {
  const r = Number(revenue) || 0;
  if (r <= 0) return 0;
  if (r < 100_000_000) return 400_000;
  if (r < 300_000_000) return 400_000 + (r - 100_000_000) * 0.002;
  if (r < 500_000_000) return 800_000 + (r - 300_000_000) * 0.001;
  if (r < 1_000_000_000) return 1_000_000 + (r - 500_000_000) * 0.0005;
  if (r < 3_000_000_000) return 1_250_000 + (r - 1_000_000_000) * 0.0004;
  if (r < 5_000_000_000) return 2_050_000 + (r - 3_000_000_000) * 0.0003;
  if (r < 10_000_000_000) return 2_650_000 + (r - 5_000_000_000) * 0.0002;
  if (r < 50_000_000_000) return 3_650_000 + (r - 10_000_000_000) * 0.0001;
  return 7_650_000 + (r - 50_000_000_000) * 0.00005;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadTextFile(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [clients, setClients] = useState([]);
  const [histories, setHistories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSecondPhone, setShowSecondPhone] = useState(false);
  const [wasJointBusiness, setWasJointBusiness] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [activeView, setActiveView] = useState("clients");
  const [openMenus, setOpenMenus] = useState({ clients: true, filings: true, reports: true, statements: true });
  const [progressMonth, setProgressMonth] = useState(getCurrentMonth());
  const [progressItems, setProgressItems] = useState(() => readLocalState("bookkeepingProgress", {}));
  const [filingType, setFilingType] = useState("withholding");
  const [filingMonth, setFilingMonth] = useState(getCurrentMonth());
  const [filingYear, setFilingYear] = useState(getCurrentYear());
  const [vatPeriod, setVatPeriod] = useState("1기 예정");
  const [corporateMode, setCorporateMode] = useState("정기신고");
  const [filingItems, setFilingItems] = useState(() => readLocalState("taxFilingProgress", {}));
  const [openWithholdingDetails, setOpenWithholdingDetails] = useState({});
  const [correctionItems, setCorrectionItems] = useState(() => readLocalState("correctionFilings", []));
  const [correctionForm, setCorrectionForm] = useState(emptyCorrectionForm);
  const [editingCorrectionId, setEditingCorrectionId] = useState(null);
  const [reviewType, setReviewType] = useState("vat");
  const [reviewMonth, setReviewMonth] = useState(getCurrentMonth());
  const [reviewYear, setReviewYear] = useState(getCurrentYear());
  const [reviewVatPeriod, setReviewVatPeriod] = useState("1기 예정");
  const [reviewCorporateMode, setReviewCorporateMode] = useState("정기신고");
  const [reviewRows, setReviewRows] = useState(() => readLocalState("reviewUploads", { rows: [], uploadMode: "amount" }).rows || []);
  const [reviewUploadMode, setReviewUploadMode] = useState(() => readLocalState("reviewUploads", { rows: [], uploadMode: "amount" }).uploadMode || "amount");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("전체");
  const [statementType, setStatementType] = useState("business_simple");
  const [statementMonth, setStatementMonth] = useState(getCurrentMonth());
  const [statementYear, setStatementYear] = useState(getCurrentYear());
  const [statementHalf, setStatementHalf] = useState("상반기");
  const [statementRows, setStatementRows] = useState(() => readLocalState("statementUploads", { rows: [] }).rows || []);
  const [statementStatusFilter, setStatementStatusFilter] = useState("전체");
  const [incomeReportYear, setIncomeReportYear] = useState(getCurrentYear());
  const [incomeReportClientId, setIncomeReportClientId] = useState("");
  const [incomeReportNotes, setIncomeReportNotes] = useState(() => readLocalState("incomeReportNotes", {}));
  const [incomeReportUploads, setIncomeReportUploads] = useState(() => readLocalState("incomeReportUploads", {}));
  const [incomeReportSavedReports, setIncomeReportSavedReports] = useState(() => readLocalState("incomeReportSavedReports", {}));
  const [incomeExpenseRates, setIncomeExpenseRates] = useState(() => readLocalState("incomeExpenseRates", []));
  const [incomeReportParsing, setIncomeReportParsing] = useState(false);
  const [bulkPrintMode, setBulkPrintMode] = useState(false);
  const [sharedStorageReady, setSharedStorageReady] = useState(false);
  const yearOptions = useMemo(() => getYearOptions(), []);

  function persistSharedState(key, value) {
    localStorage.setItem(key, JSON.stringify(value));

    supabase
      .from("app_state")
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) {
          setSharedStorageReady(false);
          setMessage("공용 저장소에 저장하지 못했습니다. Supabase app_state 테이블을 확인해주세요.");
        } else {
          setSharedStorageReady(true);
        }
      });
  }

  async function loadSharedState() {
    const localStates = sharedStateConfigs.reduce((items, config) => ({
      ...items,
      [config.key]: readLocalState(config.key, config.fallback),
    }), {});

    try {
      const { data, error } = await supabase
        .from("app_state")
        .select("key,value")
        .in("key", sharedStateConfigs.map((config) => config.key));

      if (error) throw error;

      const remoteStates = (data || []).reduce((items, item) => ({ ...items, [item.key]: item.value }), {});
      const nextProgressItems = remoteStates.bookkeepingProgress ?? localStates.bookkeepingProgress;
      const nextFilingItems = remoteStates.taxFilingProgress ?? localStates.taxFilingProgress;
      const nextCorrectionItems = remoteStates.correctionFilings ?? localStates.correctionFilings;
      const nextReviewUploads = remoteStates.reviewUploads ?? localStates.reviewUploads;
      const nextStatementUploads = remoteStates.statementUploads ?? localStates.statementUploads;
      const nextIncomeReportNotes = remoteStates.incomeReportNotes ?? localStates.incomeReportNotes;
      const nextIncomeReportUploads = remoteStates.incomeReportUploads ?? localStates.incomeReportUploads;
      const nextIncomeReportSavedReports = remoteStates.incomeReportSavedReports ?? localStates.incomeReportSavedReports;
      const nextIncomeExpenseRates = remoteStates.incomeExpenseRates ?? localStates.incomeExpenseRates;

      setProgressItems(nextProgressItems);
      setFilingItems(nextFilingItems);
      setCorrectionItems(nextCorrectionItems);
      setReviewRows(nextReviewUploads.rows || []);
      setReviewUploadMode(nextReviewUploads.uploadMode || "amount");
      setStatementRows(nextStatementUploads.rows || []);
      setIncomeReportNotes(nextIncomeReportNotes || {});
      setIncomeReportUploads(nextIncomeReportUploads || {});
      setIncomeReportSavedReports(nextIncomeReportSavedReports || {});
      setIncomeExpenseRates(nextIncomeExpenseRates || []);
      setSharedStorageReady(true);

      const missingRows = sharedStateConfigs
        .filter((config) => remoteStates[config.key] === undefined && hasStateValue(localStates[config.key]))
        .map((config) => ({ key: config.key, value: localStates[config.key], updated_at: new Date().toISOString() }));

      if (missingRows.length > 0) {
        await supabase.from("app_state").upsert(missingRows);
      }
    } catch {
      setSharedStorageReady(false);
      setMessage("공용 저장소 테이블이 아직 없어 로컬 저장으로 실행 중입니다. supabase-app-state.sql을 Supabase에서 실행해주세요.");
    }
  }

  async function loadClients() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
        setClients([]);
      } else {
        setClients(data || []);
      }
    } catch (error) {
      setMessage(error.message || "거래처 목록을 불러오지 못했습니다.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistories() {
    const { data, error } = await supabase
      .from("client_histories")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(80);

    if (!error) {
      setHistories(data || []);
    } else {
      setHistories([]);
      setMessage(`변경 이력을 불러오지 못했습니다: ${error.message}`);
    }
  }

  function changeForm(event) {
    const { name, type, checked, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : formatField(name, value) }));
  }

  function buildPayload() {
    return buildClientPayload(form, showSecondPhone);
  }

  function getHistoryRows(clientId, before, after) {
    const trackedFields = [
      ["is_joint_business", "공동사업자 여부"],
      ["joint_share_ratio", "지분율"],
      ["joint_owner_name", "공동대표 성함"],
      ["joint_resident_number", "공동대표 주민번호"],
      ["joint_start_date", "공동사업자 시작일"],
      ["joint_end_date", "공동사업자 종료일"],
      ["status", "상태"],
    ];

    return trackedFields
      .filter(([key]) => valueLabel(before[key]) !== valueLabel(after[key]))
      .map(([key, label]) => ({
        client_id: clientId,
        company_name: after.company_name || before.company_name,
        change_type: label,
        before_value: valueLabel(before[key]),
        after_value: valueLabel(after[key]),
        note: after.memo || "",
      }));
  }

  async function saveHistoryRows(rows) {
    if (rows.length === 0) return null;
    const { error } = await supabase.from("client_histories").insert(rows);
    if (!error) {
      await loadHistories();
      return null;
    } else {
      return error.message;
    }
  }

  async function saveClient(event) {
    event.preventDefault();

    if (!form.company_name.trim()) {
      setMessage("업체명은 꼭 입력해야 합니다.");
      return;
    }

    if (!form.business_number.trim()) {
      setMessage("사업자번호는 꼭 입력해야 합니다.");
      return;
    }

    if (!form.owner_name.trim()) {
      setMessage("대표자명은 꼭 입력해야 합니다.");
      return;
    }

    setSaving(true);
    const payload = buildPayload();

    const beforeClient = editingId ? normalizeClient(clients.find((client) => client.id === editingId) || {}) : null;
    const request = editingId
      ? supabase.from("clients").update(payload).eq("id", editingId)
      : supabase.from("clients").insert(payload);

    const { error } = await request;

    if (error) {
      setMessage(error.message);
    } else {
      const afterClient = normalizeClient(payload);
      let historyError = null;
      if (editingId && beforeClient) {
        historyError = await saveHistoryRows(getHistoryRows(editingId, beforeClient, afterClient));
      } else if (!editingId && afterClient.is_joint_business) {
        historyError = await saveHistoryRows([
          {
            client_id: null,
            company_name: afterClient.company_name,
            change_type: "공동사업자 등록",
            before_value: "부",
            after_value: "여",
            note: afterClient.memo || "",
          },
        ]);
      }
      setMessage(
        historyError
          ? `거래처 저장은 완료됐지만 변경 이력 저장은 실패했습니다: ${historyError}`
          : editingId
            ? "거래처 정보가 수정되었습니다."
            : "신규 거래처가 등록되었습니다.",
      );
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setShowSecondPhone(false);
      setWasJointBusiness(false);
      await loadClients();
    }

    setSaving(false);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setShowSecondPhone(false);
    setWasJointBusiness(false);
    setShowForm(true);
  }

  function openImportForm() {
    setMessage("");
    setShowImport(true);
  }

  function startEdit(client) {
    const normalized = normalizeClient(client);
    setEditingId(client.id);
    setForm(normalized);
    setMessage(`${client.company_name} 정보를 수정 중입니다.`);
    setShowSecondPhone(Boolean(normalized.phone2));
    setWasJointBusiness(Boolean(normalized.is_joint_business));
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setShowSecondPhone(false);
    setWasJointBusiness(false);
    setShowForm(false);
    setMessage("");
  }

  function openFilingView(type) {
    setFilingType(type);
    setActiveView("filing");
  }

  function saveCorrection(event) {
    event.preventDefault();
    if (!correctionForm.company_name.trim()) {
      setMessage("수정신고 거래처명을 입력해주세요.");
      return;
    }

    const nextItem = {
      ...correctionForm,
      id: editingCorrectionId || crypto.randomUUID(),
      created_at:
        correctionItems.find((item) => item.id === editingCorrectionId)?.created_at || new Date().toISOString(),
      tax_difference: formatSignedNumberWithCommas(correctionForm.tax_difference),
      local_tax_difference: formatSignedNumberWithCommas(correctionForm.local_tax_difference),
    };
    const nextItems = editingCorrectionId
      ? correctionItems.map((item) => (item.id === editingCorrectionId ? nextItem : item))
      : [nextItem, ...correctionItems];
    setCorrectionItems(nextItems);
    persistSharedState("correctionFilings", nextItems);
    setCorrectionForm(emptyCorrectionForm);
    setEditingCorrectionId(null);
    setMessage(editingCorrectionId ? "수정신고 건이 수정되었습니다." : "수정신고 건이 추가되었습니다.");
  }

  function changeCorrectionForm(event) {
    const { name, type, checked, value } = event.target;
    setCorrectionForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : ["tax_difference", "local_tax_difference"].includes(name)
            ? formatSignedNumberWithCommas(value)
            : value,
    }));
  }

  function editCorrection(item) {
    setEditingCorrectionId(item.id);
    setCorrectionForm({
      ...emptyCorrectionForm,
      ...item,
      local_tax_difference: item.local_tax_difference || "",
    });
  }

  function cancelCorrectionEdit() {
    setEditingCorrectionId(null);
    setCorrectionForm(emptyCorrectionForm);
  }

  function deleteCorrection(id) {
    const nextItems = correctionItems.filter((item) => item.id !== id);
    setCorrectionItems(nextItems);
    persistSharedState("correctionFilings", nextItems);
  }

  function openStatementView(type) {
    setStatementType(type);
    setActiveView("statement");
  }

  async function importReviewRows(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = (await parseUploadedRows(file)).map((row) => ({
        ...getUploadIdentifier(row),
        raw: row,
      }));
      const amountAliases = Object.values(reviewFieldConfigs).flat().flatMap((field) => field.aliases);
      const hasAmountColumns = rows.some((row) => amountAliases.some((alias) => String(getCsvValue(row.raw, alias)).trim()));
      const uploadMode = hasAmountColumns ? "amount" : "receipt";
      setReviewRows(rows);
      setReviewUploadMode(uploadMode);
      persistSharedState("reviewUploads", { rows, uploadMode });
      setMessage(`홈택스 자료 ${rows.length}건을 불러왔습니다.${hasAmountColumns ? "" : " 접수내역 파일로 보여서 접수 여부 중심으로 확인합니다."}`);
    } catch (error) {
      setMessage(`홈택스 자료를 읽지 못했습니다: ${error.message || "파일 형식을 확인해주세요."}`);
    }
  }

  async function importStatementRows(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = (await parseUploadedRows(file)).map((row) => ({
        ...getUploadIdentifier(row),
        raw: row,
      }));
      setStatementRows(rows);
      setStatementStatusFilter("전체");
      persistSharedState("statementUploads", { rows });
      setMessage(`홈택스 지급명세서 자료 ${rows.length}건을 불러왔습니다.`);
    } catch (error) {
      setMessage(`홈택스 지급명세서 자료를 읽지 못했습니다: ${error.message || "파일 형식을 확인해주세요."}`);
    }
  }

  function closeImportForm() {
    setShowImport(false);
  }

  async function importClientsFromCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setSaving(true);
    setMessage("거래처 파일을 불러오는 중입니다.");

    try {
      const text = decodeCsv(await file.arrayBuffer());
      const importedRows = parseCsv(text).map(mapImportRow).filter((row) => row.company_name && row.business_number);
      const rowsByBusinessNumber = new Map();

      importedRows.forEach((row) => {
        rowsByBusinessNumber.set(onlyDigits(row.business_number), row);
      });

      const rows = Array.from(rowsByBusinessNumber.values());

      if (rows.length === 0) {
        setMessage("가져올 거래처가 없습니다. CSV 첫 줄의 제목과 내용을 확인해주세요.");
        return;
      }

      const { data: freshClients, error: freshError } = await supabase.from("clients").select("*");
      if (freshError) throw freshError;

      const existingByBusinessNumber = new Map();
      (freshClients || []).forEach((client) => {
          const normalized = normalizeClient(client);
          const key = onlyDigits(normalized.business_number);
          if (!key) return;
          const current = existingByBusinessNumber.get(key) || [];
          existingByBusinessNumber.set(key, [...current, client]);
        });

      let inserted = 0;
      let updated = 0;

      for (const row of rows) {
        const key = onlyDigits(row.business_number);
        const existingClients = existingByBusinessNumber.get(key) || [];
        const payload = buildClientPayload(row, Boolean(row.phone2));

        if (existingClients.length > 0) {
          const ids = existingClients.map((client) => client.id).filter(Boolean);
          const { error } = await supabase.from("clients").update(payload).in("id", ids);
          if (error) throw error;
          updated += 1;
        } else {
          const { error } = await supabase.from("clients").insert(payload);
          if (error) throw error;
          inserted += 1;
        }
      }

      const skipped = importedRows.length - rows.length;
      setMessage(`일괄 업로드 완료: 신규 ${inserted}건, 업데이트 ${updated}건${skipped ? `, 중복 행 제외 ${skipped}건` : ""}`);
      setShowImport(false);
      await loadClients();
    } catch (error) {
      setMessage(`일괄 업로드 실패: ${error.message || "파일을 읽지 못했습니다."}`);
    } finally {
      setSaving(false);
    }
  }

  function addSecondPhone() {
    setShowSecondPhone(true);
  }

  function removeSecondPhone() {
    setForm((prev) => ({ ...prev, phone2: "" }));
    setShowSecondPhone(false);
  }

  async function deleteClient(client) {
    const confirmed = window.confirm(`${client.company_name} 거래처를 삭제할까요? 삭제하면 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    setSaving(true);
    const { error } = await supabase.from("clients").delete().eq("id", client.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("거래처가 삭제되었습니다.");
      if (editingId === client.id) cancelEdit();
      await loadClients();
    }

    setSaving(false);
  }

  const filteredClients = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return clients
      .filter((client) => {
        const normalized = normalizeClient(client);
        const matchesKeyword = [
          normalized.company_name,
          normalized.business_number,
          normalized.owner_name,
          normalized.phone,
          normalized.phone2,
          normalized.email,
          normalized.joint_owner_name,
          normalized.joint_resident_number,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
        const matchesStatus = statusFilter === "전체" || normalized.status === statusFilter;
        return matchesKeyword && matchesStatus;
      })
      .sort(sortClients);
  }, [clients, query, statusFilter]);

  const jointClients = useMemo(
    () =>
      filteredClients.filter((client) => {
        const item = normalizeClient(client);
        return (
          item.is_joint_business ||
          item.joint_owner_name ||
          item.joint_resident_number ||
          item.joint_share_ratio ||
          item.joint_start_date ||
          item.joint_end_date
        );
      }),
    [filteredClients],
  );

  const groupedHistories = useMemo(() => {
    const groups = new Map();

    histories.forEach((history) => {
      const changedAt = history.changed_at || "";
      const timeKey = changedAt ? new Date(changedAt).toISOString().slice(0, 19) : history.id;
      const key = `${history.company_name}-${timeKey}`;
      const current = groups.get(key) || {
        id: key,
        changed_at: history.changed_at,
        company_name: history.company_name,
        note: history.note,
        changes: [],
      };

      current.changes.push(history);
      if (history.note && !current.note) current.note = history.note;
      groups.set(key, current);
    });

    return Array.from(groups.values()).map((group) => {
      const jointChange = group.changes.find((change) => change.change_type === "공동사업자 여부");
      const type =
        jointChange?.before_value === "부" && jointChange?.after_value === "여"
          ? "공동사업자 등록"
          : jointChange?.before_value === "여" && jointChange?.after_value === "부"
            ? "공동사업자 종료"
            : "정보 변경";

      return {
        ...group,
        type,
        summary: group.changes
          .map((change) => `${change.change_type}: ${change.before_value} → ${change.after_value}`)
          .join(" / "),
      };
    });
  }, [histories]);

  const bookkeepingTotal = useMemo(
    () =>
      filteredClients.reduce((sum, client) => {
        return sum + toNumber(normalizeClient(client).bookkeeping_fee);
      }, 0),
    [filteredClients],
  );

  const activeClients = useMemo(
    () => filteredClients.filter((client) => normalizeClient(client).status === "계속"),
    [filteredClients],
  );

  function getProgressKey(client) {
    const item = normalizeClient(client);
    return onlyDigits(item.business_number) || client.id;
  }

  const getProgressValue = useCallback((client, task) => {
    const key = getProgressKey(client);
    const clientData = progressItems[progressMonth]?.[key] || {};
    return Boolean(clientData[task]);
  }, [progressItems, progressMonth]);

  function toggleProgress(client, task) {
    const key = getProgressKey(client);
    setProgressItems((prev) => {
      const monthData = prev[progressMonth] || {};
      const clientData = monthData[key] || {};
      const next = {
        ...prev,
        [progressMonth]: {
          ...monthData,
          [key]: {
            ...clientData,
            [task]: !clientData[task],
          },
        },
      };

      persistSharedState("bookkeepingProgress", next);
      return next;
    });
  }

  const getClientProgressCount = useCallback((client) => {
    return bookkeepingTasks.filter((task) => getProgressValue(client, task)).length;
  }, [getProgressValue]);

  const getClientMissingTasks = useCallback((client) => {
    return bookkeepingTasks.filter((task) => !getProgressValue(client, task));
  }, [getProgressValue]);

  function toggleClientProgressAll(client) {
    const key = getProgressKey(client);
    const complete = getClientProgressCount(client) === bookkeepingTasks.length;

    setProgressItems((prev) => {
      const monthData = prev[progressMonth] || {};
      const clientData = monthData[key] || {};
      const nextClientData = bookkeepingTasks.reduce(
        (result, task) => ({ ...result, [task]: !complete }),
        { ...clientData },
      );
      const next = {
        ...prev,
        [progressMonth]: {
          ...monthData,
          [key]: nextClientData,
        },
      };

      persistSharedState("bookkeepingProgress", next);
      return next;
    });
  }

  function toggleVisibleProgressAll() {
    const shouldCheck = activeClients.some((client) => getClientProgressCount(client) < bookkeepingTasks.length);

    setProgressItems((prev) => {
      const monthData = prev[progressMonth] || {};
      const nextMonthData = { ...monthData };

      activeClients.forEach((client) => {
        const key = getProgressKey(client);
        const clientData = nextMonthData[key] || {};
        nextMonthData[key] = bookkeepingTasks.reduce(
          (result, task) => ({ ...result, [task]: shouldCheck }),
          { ...clientData },
        );
      });

      const next = {
        ...prev,
        [progressMonth]: nextMonthData,
      };

      persistSharedState("bookkeepingProgress", next);
      return next;
    });
  }

  const progressSummary = useMemo(() => {
    const total = activeClients.length * bookkeepingTasks.length;
    const done = activeClients.reduce((sum, client) => sum + getClientProgressCount(client), 0);
    const taskStats = bookkeepingTasks.map((task) => {
      const taskDone = activeClients.filter((client) => getProgressValue(client, task)).length;
      return {
        task,
        done: taskDone,
        total: activeClients.length,
        missing: activeClients.length - taskDone,
      };
    });
    const incompleteClients = activeClients
      .map((client) => {
        const item = normalizeClient(client);
        const missingTasks = getClientMissingTasks(client);
        return {
          id: client.id,
          company_name: item.company_name,
          missingTasks,
        };
      })
      .filter((client) => client.missingTasks.length > 0);

    return {
      total,
      done,
      rate: total ? Math.round((done / total) * 100) : 0,
      taskStats,
      incompleteClients,
    };
  }, [activeClients, getClientMissingTasks, getClientProgressCount, getProgressValue]);

  const selectedFiling = taxFilingTypes[filingType];
  const activeCorporateAmountFields = corporateMode === "중간예납" ? corporatePrepayFields : corporateAmountFields;
  const activeCorporateTasks = corporateMode === "중간예납" ? ["전자신고", "납부서 전달"] : selectedFiling.tasks;
  const activeFilingTasks = filingType === "corporate" ? activeCorporateTasks : selectedFiling.tasks;
  const filingPeriodKey = useMemo(() => {
    if (filingType === "vat") return `${filingYear} ${vatPeriod}`;
    if (filingType === "income") return `${filingYear} 귀속`;
    if (filingType === "corporate") return `${filingYear} ${corporateMode}`;
    return filingMonth;
  }, [corporateMode, filingMonth, filingType, filingYear, vatPeriod]);

  const filingClients = useMemo(
    () => {
      const targets = activeClients.filter((client) => selectedFiling.applies(normalizeClient(client)));

      if (filingType !== "withholding") return targets;

      return [...targets].sort((a, b) => {
        const left = normalizeClient(a);
        const right = normalizeClient(b);
        return (
          getWithholdingOrder(left.withholding_type) - getWithholdingOrder(right.withholding_type) ||
          left.company_name.localeCompare(right.company_name, "ko-KR", { numeric: true })
        );
      });
    },
    [activeClients, filingType, selectedFiling],
  );

  function getFilingKey(client) {
    const item = normalizeClient(client);
    return onlyDigits(item.business_number) || client.id;
  }

  const getFilingValue = useCallback((client, task) => {
    const key = getFilingKey(client);
    const clientData = filingItems[filingPeriodKey]?.[filingType]?.[key] || {};
    return Boolean(clientData[task]);
  }, [filingItems, filingPeriodKey, filingType]);

  const getFilingDetailValue = useCallback((client, field) => {
    const key = getFilingKey(client);
    const clientData = filingItems[filingPeriodKey]?.[filingType]?.[key] || {};
    return clientData._details?.[field] || "";
  }, [filingItems, filingPeriodKey, filingType]);

  function getWithholdingPaymentTotal(client) {
    return withholdingAmountFields.reduce((sum, field) => {
      return sum + toNumber(getFilingDetailValue(client, field.key));
    }, 0);
  }

  function toggleWithholdingDetail(client) {
    const key = getFilingKey(client);
    setOpenWithholdingDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const isFilingExcluded = useCallback((client) => {
    if (filingType !== "withholding") return false;
    return getFilingDetailValue(client, "excluded") === "yes";
  }, [filingType, getFilingDetailValue]);

  function toggleFilingProgress(client, task) {
    const key = getFilingKey(client);
    setFilingItems((prev) => {
      const monthData = prev[filingPeriodKey] || {};
      const typeData = monthData[filingType] || {};
      const clientData = typeData[key] || {};
      const next = {
        ...prev,
        [filingPeriodKey]: {
          ...monthData,
          [filingType]: {
            ...typeData,
            [key]: {
              ...clientData,
              [task]: !clientData[task],
            },
          },
        },
      };

      persistSharedState("taxFilingProgress", next);
      return next;
    });
  }

  function changeFilingDetail(client, field, value) {
    const key = getFilingKey(client);
    const nextValue = [
      ...withholdingAmountFields,
      ...withholdingTaxFields,
      ...vatAmountFields,
      ...incomeAmountFields,
      ...corporateAmountFields,
      ...corporatePrepayFields,
    ].some((item) => item.key === field)
      ? formatSignedNumberWithCommas(value)
      : value;

    setFilingItems((prev) => {
      const monthData = prev[filingPeriodKey] || {};
      const typeData = monthData[filingType] || {};
      const clientData = typeData[key] || {};
      const next = {
        ...prev,
        [filingPeriodKey]: {
          ...monthData,
          [filingType]: {
            ...typeData,
            [key]: {
              ...clientData,
              _details: {
                ...(clientData._details || {}),
                [field]: nextValue,
              },
            },
          },
        },
      };

      persistSharedState("taxFilingProgress", next);
      return next;
    });
  }

  function blurFilingAmount(client, field, event) {
    const nextValue = formatSignedNumberWithCommas(event.target.value);
    event.target.value = nextValue;
    changeFilingDetail(client, field, nextValue);
  }

  function handleAmountKeyDown(event) {
    if (event.key !== "+") return;
    event.preventDefault();

    const negative = String(event.currentTarget.value).trim().startsWith("-");
    const digits = onlyDigits(event.currentTarget.value);
    const nextValue = digits ? formatSignedNumberWithCommas(`${negative ? "-" : ""}${digits}000`) : "1,000";
    event.currentTarget.value = nextValue;
  }

  function toggleFilingExcluded(client) {
    changeFilingDetail(client, "excluded", isFilingExcluded(client) ? "" : "yes");
  }

  function toggleFilingTaskForAll(task) {
    const targets = filingClients.filter((client) => !isFilingExcluded(client));
    const shouldCheck = targets.some((client) => !getFilingValue(client, task));

    setFilingItems((prev) => {
      const monthData = prev[filingPeriodKey] || {};
      const typeData = monthData[filingType] || {};
      const nextTypeData = { ...typeData };

      targets.forEach((client) => {
        const key = getFilingKey(client);
        nextTypeData[key] = {
          ...(nextTypeData[key] || {}),
          [task]: shouldCheck,
        };
      });

      const next = {
        ...prev,
        [filingPeriodKey]: {
          ...monthData,
          [filingType]: nextTypeData,
        },
      };

      persistSharedState("taxFilingProgress", next);
      return next;
    });
  }

  const getFilingProgressCount = useCallback((client) => {
    return activeFilingTasks.filter((task) => getFilingValue(client, task)).length;
  }, [activeFilingTasks, getFilingValue]);

  const getFilingMissingTasks = useCallback((client) => {
    return activeFilingTasks.filter((task) => !getFilingValue(client, task));
  }, [activeFilingTasks, getFilingValue]);

  function toggleFilingClientAll(client) {
    const key = getFilingKey(client);
    const complete = getFilingProgressCount(client) === activeFilingTasks.length;

    setFilingItems((prev) => {
      const monthData = prev[filingPeriodKey] || {};
      const typeData = monthData[filingType] || {};
      const clientData = typeData[key] || {};
      const nextClientData = activeFilingTasks.reduce(
        (result, task) => ({ ...result, [task]: !complete }),
        { ...clientData },
      );
      const next = {
        ...prev,
        [filingPeriodKey]: {
          ...monthData,
          [filingType]: {
            ...typeData,
            [key]: nextClientData,
          },
        },
      };

      persistSharedState("taxFilingProgress", next);
      return next;
    });
  }

  function toggleVisibleFilingAll() {
    const targets = filingClients.filter((client) => !isFilingExcluded(client));
    const shouldCheck = targets.some((client) => getFilingProgressCount(client) < activeFilingTasks.length);

    setFilingItems((prev) => {
      const monthData = prev[filingPeriodKey] || {};
      const typeData = monthData[filingType] || {};
      const nextTypeData = { ...typeData };

      targets.forEach((client) => {
        const key = getFilingKey(client);
        const clientData = nextTypeData[key] || {};
        nextTypeData[key] = activeFilingTasks.reduce(
          (result, task) => ({ ...result, [task]: shouldCheck }),
          { ...clientData },
        );
      });

      const next = {
        ...prev,
        [filingPeriodKey]: {
          ...monthData,
          [filingType]: nextTypeData,
        },
      };

      persistSharedState("taxFilingProgress", next);
      return next;
    });
  }

  const filingSummary = useMemo(() => {
    const countedClients = filingClients.filter((client) => !isFilingExcluded(client));
    const total = countedClients.length * activeFilingTasks.length;
    const done = countedClients.reduce((sum, client) => sum + getFilingProgressCount(client), 0);
    const adjustmentTotal = ["income", "corporate"].includes(filingType)
      ? countedClients.reduce((sum, client) => sum + toNumber(getFilingDetailValue(client, "adjustment_fee")), 0)
      : 0;
    const taskStats = activeFilingTasks.map((task) => {
      const taskDone = countedClients.filter((client) => getFilingValue(client, task)).length;
      return {
        task,
        done: taskDone,
        total: countedClients.length,
        missing: countedClients.length - taskDone,
      };
    });
    const incompleteClients = countedClients
      .map((client) => {
        const item = normalizeClient(client);
        const missingTasks = getFilingMissingTasks(client);
        return {
          id: client.id,
          company_name: item.company_name,
          missingTasks,
        };
      })
      .filter((client) => client.missingTasks.length > 0);

    return {
      total,
      done,
      rate: total ? Math.round((done / total) * 100) : 0,
      taskStats,
      incompleteClients,
      excluded: filingClients.length - countedClients.length,
      adjustmentTotal,
    };
  }, [
    activeFilingTasks,
    filingType,
    filingClients,
    getFilingMissingTasks,
    getFilingProgressCount,
    getFilingDetailValue,
    getFilingValue,
    isFilingExcluded,
  ]);

  const selectedStatement = paymentStatementTypes[statementType];
  const statementPeriodKey = useMemo(
    () => getPaymentStatementPeriodKey(statementType, statementMonth, statementYear, statementHalf),
    [statementHalf, statementMonth, statementType, statementYear],
  );
  const statementSourceMonths = useMemo(
    () => getStatementSourceMonths(statementType, statementMonth, statementYear, statementHalf),
    [statementHalf, statementMonth, statementType, statementYear],
  );

  const hasStatementInput = useCallback((client) => {
    const key = getFilingKey(client);
    return statementSourceMonths.some((month) => {
      const details = filingItems[month]?.withholding?.[key]?._details || {};
      const value = details[selectedStatement.amountField];
      return toNumber(value) > 0;
    });
  }, [filingItems, selectedStatement.amountField, statementSourceMonths]);

  const statementClients = useMemo(
    () => activeClients.filter((client) => selectedStatement.applies(normalizeClient(client)) && hasStatementInput(client)),
    [activeClients, hasStatementInput, selectedStatement],
  );

  function getStatementExpectedAmount(client) {
    const key = getFilingKey(client);
    return statementSourceMonths.reduce((sum, month) => {
      const details = filingItems[month]?.withholding?.[key]?._details || {};
      return sum + toNumber(details[selectedStatement.amountField]);
    }, 0);
  }

  function findStatementRow(client) {
    const item = normalizeClient(client);
    const businessNumber = onlyDigits(item.business_number);
    const residentNumber = onlyDigits(item.resident_number);
    const companyName = normalizeHeaderName(item.company_name);
    return statementRows.find((row) => {
      const rowBusinessNumber = onlyDigits(row.business_number);
      const rowResidentNumber = onlyDigits(row.resident_number);
      const rowCompanyName = normalizeHeaderName(row.company_name);
      return (
        (businessNumber && rowBusinessNumber === businessNumber) ||
        (residentNumber && rowResidentNumber === residentNumber) ||
        (companyName && rowCompanyName && (rowCompanyName === companyName || rowCompanyName.includes(companyName) || companyName.includes(rowCompanyName)))
      );
    });
  }

  function getStatementHomeTaxAmount(row) {
    if (!row) return null;
    const value = getCsvValue(row.raw, selectedStatement.aliases);
    return String(value ?? "").trim() ? toNumber(value) : null;
  }

  const statementReviewRows = statementClients
    .map((client) => {
      const item = normalizeClient(client);
      const row = findStatementRow(client);
      const appAmount = getStatementExpectedAmount(client);
      const homeTaxAmount = getStatementHomeTaxAmount(row);
      const diff = homeTaxAmount === null ? null : appAmount - homeTaxAmount;
      const status = !row ? "홈택스 없음" : homeTaxAmount === null ? "금액 없음" : diff === 0 ? "일치" : "차이";

      return {
        id: client.id,
        item,
        appAmount,
        homeTaxAmount,
        diff,
        status,
      };
    })
    .filter((row) => row.appAmount > 0);

  const statementRowsWithInput = useMemo(
    () => statementReviewRows.filter((row) => toNumber(row.appAmount) > 0),
    [statementReviewRows],
  );

  const filteredStatementReviewRows = useMemo(() => {
    if (statementStatusFilter === "전체") return statementRowsWithInput;
    return statementRowsWithInput.filter((row) => row.status === statementStatusFilter);
  }, [statementRowsWithInput, statementStatusFilter]);

  const reviewPeriodKey = useMemo(
    () => getReviewPeriodKey(reviewType, reviewYear, reviewMonth, reviewVatPeriod, reviewCorporateMode),
    [reviewCorporateMode, reviewMonth, reviewType, reviewVatPeriod, reviewYear],
  );

  const reviewClients = useMemo(
    () => activeClients.filter((client) => taxFilingTypes[reviewType].applies(normalizeClient(client))),
    [activeClients, reviewType],
  );

  const findReviewRow = useCallback((client) => {
    const item = normalizeClient(client);
    const businessNumber = onlyDigits(item.business_number);
    const residentNumber = onlyDigits(item.resident_number);
    const companyName = normalizeHeaderName(item.company_name);
    return reviewRows.find((row) => {
      const rowBusinessNumber = onlyDigits(row.business_number);
      const rowResidentNumber = onlyDigits(row.resident_number);
      const rowCompanyName = normalizeHeaderName(row.company_name);
      return (
        (businessNumber && rowBusinessNumber === businessNumber) ||
        (residentNumber && rowResidentNumber === residentNumber) ||
        (companyName && rowCompanyName && (rowCompanyName === companyName || rowCompanyName.includes(companyName) || companyName.includes(rowCompanyName)))
      );
    });
  }, [reviewRows]);

  const getStoredReviewAmount = useCallback((client, field) => {
    const key = getFilingKey(client);
    const clientData = filingItems[reviewPeriodKey]?.[reviewType]?.[key] || {};
    if (reviewType === "withholding" && field === "total_payment") {
      return withholdingAmountFields.reduce((sum, item) => sum + toNumber(clientData._details?.[item.key]), 0);
    }
    return toNumber(clientData._details?.[field]);
  }, [filingItems, reviewPeriodKey, reviewType]);

  function getHomeTaxAmount(row, aliases) {
    if (!row) return null;
    const value = getCsvValue(row.raw, aliases);
    return String(value ?? "").trim() ? toNumber(value) : null;
  }

  const reviewRowsByClient = useMemo(() => {
    const fields = reviewFieldConfigs[reviewType] || [];
    return reviewClients.filter((client) => {
      const item = normalizeClient(client);
      return !(reviewType === "withholding" && item.withholding_type === "반기" && !isSemiannualReviewMonth(reviewMonth));
    }).map((client) => {
      const item = normalizeClient(client);
      const row = findReviewRow(client);
      const comparisons = fields.map((field) => {
        const appAmount = getStoredReviewAmount(client, field.key);
        const homeTaxAmount = getHomeTaxAmount(row, field.aliases);
        const refundCarriedForward =
          reviewType === "withholding" &&
          field.key === "income_tax" &&
          appAmount < 0 &&
          homeTaxAmount === 0;
        const diff = homeTaxAmount === null ? null : refundCarriedForward ? 0 : appAmount - homeTaxAmount;
        return {
          ...field,
          appAmount,
          homeTaxAmount,
          diff,
          matched: diff === 0,
          refundCarriedForward,
        };
      });
      const hasHomeTaxAmount = comparisons.some((item) => item.homeTaxAmount !== null);
      const diffTotal = comparisons.reduce((sum, item) => sum + Math.abs(item.diff || 0), 0);
      const allComparedFieldsMatched = comparisons.every((item) => item.homeTaxAmount === null || item.matched);
      const status = !row
          ? "홈택스 없음"
          : !hasHomeTaxAmount || reviewUploadMode === "receipt"
            ? "접수 확인"
            : diffTotal === 0 && allComparedFieldsMatched
              ? "일치"
              : "차이";

      return {
        id: client.id,
        item,
        row,
        comparisons,
        diffTotal,
        status,
      };
    });
  }, [findReviewRow, getStoredReviewAmount, reviewClients, reviewMonth, reviewType, reviewUploadMode]);

  const missingHomeTaxRows = useMemo(
    () => reviewRowsByClient.filter((row) => row.status === "홈택스 없음"),
    [reviewRowsByClient],
  );

  const filteredReviewRows = useMemo(() => {
    if (reviewStatusFilter === "전체") return reviewRowsByClient;
    if (reviewStatusFilter === "일치") return reviewRowsByClient.filter((row) => ["일치", "접수 확인"].includes(row.status));
    return reviewRowsByClient.filter((row) => row.status === reviewStatusFilter);
  }, [reviewRowsByClient, reviewStatusFilter]);

  const incomeReportClients = useMemo(
    () => activeClients.filter((client) => taxFilingTypes.income.applies(normalizeClient(client))),
    [activeClients],
  );

  const selectedIncomeReportClient = useMemo(() => {
    if (incomeReportClients.length === 0) return null;
    return incomeReportClients.find((client) => getFilingKey(client) === incomeReportClientId) || incomeReportClients[0];
  }, [incomeReportClientId, incomeReportClients]);

  const incomeReportPeriodKey = `${incomeReportYear} 귀속`;
  const incomeReportClientKey = selectedIncomeReportClient ? getFilingKey(selectedIncomeReportClient) : "";
  const incomeReportDetails = selectedIncomeReportClient
    ? filingItems[incomeReportPeriodKey]?.income?.[incomeReportClientKey]?._details || {}
    : {};
  const incomeReportNoteKey = selectedIncomeReportClient ? `${incomeReportYear}-${incomeReportClientKey}` : "";
  const incomeReportUpload = incomeReportUploads[incomeReportNoteKey] || {};
  const savedIncomeReport = incomeReportSavedReports[incomeReportNoteKey] || null;
  const currentIncomeReportNotes = incomeReportNotes[incomeReportNoteKey] || {
    summary: "",
    risk: "",
    industryAverageRate: "",
    localIncomeTax: "",
    ruralTax: "",
    comparison: "",
    closing: "",
    adjustmentFee: "",
    surcharge: "",
    surchargeNote: "",
    discount: "",
    bankAccount: "기업은행 038-137878-01-027",
    showFee: false,
  };

  const editableLocalIncomeTax = currentIncomeReportNotes.localIncomeTax || incomeReportDetails.local_income_tax || "";
  const editableRuralTax = currentIncomeReportNotes.ruralTax || incomeReportUpload.ruralTax || incomeReportDetails.rural_tax || "";
  const incomeReportTaxTotal =
    toNumber(incomeReportUpload.dueTax || incomeReportDetails.global_income_tax) +
    toNumber(editableLocalIncomeTax) +
    toNumber(editableRuralTax);

  function getIncomeReportValue(uploadField, detailField) {
    return incomeReportUpload[uploadField] || incomeReportDetails[detailField] || "";
  }

  const incomeReportRevenue = toNumber(incomeReportUpload.revenueTotal);
  const incomeReportBusinessIncome = toNumber(incomeReportUpload.businessIncomeTotal || getIncomeReportValue("totalIncome", "income_amount"));
  const incomeReportIncomeRate = incomeReportRevenue ? (incomeReportBusinessIncome / incomeReportRevenue) * 100 : 0;

  // 조정료 자동계산 (보수표 별표2) — 수동 입력 시 우선
  const autoFee = Math.round(calculateAdjustmentFee(incomeReportRevenue) / 1000) * 1000;
  const baseFee = currentIncomeReportNotes.adjustmentFee
    ? toNumber(currentIncomeReportNotes.adjustmentFee)
    : autoFee;
  const surchargeAmt = toNumber(currentIncomeReportNotes.surcharge);
  const discountAmt = toNumber(currentIncomeReportNotes.discount);
  const feeBeforeVat = Math.max(0, baseFee + surchargeAmt - discountAmt);
  const feeVat = Math.round(feeBeforeVat * 0.1);
  const feeTotal = feeBeforeVat + feeVat;

  function getOfficeIndustryAverageRate(code) {
    const rates = Object.values(incomeReportSavedReports)
      .filter((report) => String(report.year) === String(incomeReportYear))
      .flatMap((report) => report.totals?.businessRows || [])
      .filter((row) => row.code === code && toNumber(row.incomeRate) > 0)
      .map((row) => toNumber(row.incomeRate));

    return rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : 0;
  }

  const incomeReportBusinessRows = (incomeReportUpload.businessRows?.length
    ? incomeReportUpload.businessRows
    : (incomeReportUpload.industryCodes || []).map((code) => ({ code, revenue: 0, expense: 0, income: 0 }))
  ).map((row) => {
    const rateInfo = incomeExpenseRates.find((rate) => rate.code === row.code) || null;
    const incomeRate = row.revenue ? (toNumber(row.income) / toNumber(row.revenue)) * 100 : 0;
    const officeAverageRate = getOfficeIndustryAverageRate(row.code);
    const referenceRate = officeAverageRate || rateInfo?.referenceIncomeRate || 0;

    const simpleRate = rateInfo?.simpleRate || 0;
    const referenceSource = officeAverageRate
      ? "사무실 평균"
      : rateInfo && simpleRate
      ? `100 - ${simpleRate}%(단순경비율(일반))`
      : rateInfo
      ? "국세청 기준율"
      : "";

    return {
      ...row,
      industryName: rateInfo?.industryName || "",
      incomeRate,
      referenceRate,
      simpleRate,
      referenceSource,
      gap: referenceRate ? incomeRate - referenceRate : 0,
    };
  });

  function formatRate(value) {
    return value ? `${value.toFixed(1)}%` : "-";
  }

  function changeIncomeReportNote(field, value) {
    if (!incomeReportNoteKey) return;

    setIncomeReportNotes((prev) => {
      const next = {
        ...prev,
        [incomeReportNoteKey]: {
          ...(prev[incomeReportNoteKey] || {}),
          [field]: value,
        },
      };

      persistSharedState("incomeReportNotes", next);
      return next;
    });
  }

  async function importIncomeReportPdf(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !incomeReportNoteKey) return;

    setIncomeReportParsing(true);
    setMessage("종소세 신고서 PDF를 읽는 중입니다.");

    try {
      const text = await extractPdfText(file);
      const parsed = parseIncomeTaxReportFromPdfText(text);
      const nextUpload = {
        ...parsed,
        fileName: file.name,
        importedAt: new Date().toISOString(),
      };

      setIncomeReportUploads((prev) => {
        const next = {
          ...prev,
          [incomeReportNoteKey]: nextUpload,
        };
        persistSharedState("incomeReportUploads", next);
        return next;
      });

      setMessage("종소세 신고서에서 보고서 금액을 불러왔습니다.");
    } catch (error) {
      setMessage(`종소세 신고서를 읽지 못했습니다: ${error.message || "PDF 형식을 확인해주세요."}`);
    } finally {
      setIncomeReportParsing(false);
    }
  }

  function findIncomeReportClient(parsed) {
    const taxpayerName = normalizeHeaderName(parsed.taxpayerName);
    if (!taxpayerName) return null;

    return incomeReportClients.find((client) => {
      const item = normalizeClient(client);
      const ownerName = normalizeHeaderName(item.owner_name);
      const companyName = normalizeHeaderName(item.company_name);
      return ownerName === taxpayerName || companyName === taxpayerName || companyName.includes(taxpayerName);
    }) || null;
  }

  async function importIncomeReportPdfs(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    setIncomeReportParsing(true);
    setMessage(`종소세 신고서 ${files.length}개를 읽는 중입니다.`);

    let imported = 0;
    let unmatched = 0;
    const nextUploads = { ...incomeReportUploads };

    try {
      for (const file of files) {
        const text = await extractPdfText(file);
        const parsed = parseIncomeTaxReportFromPdfText(text);
        const matchedClient = findIncomeReportClient(parsed);

        if (!matchedClient) {
          unmatched += 1;
          continue;
        }

        const key = `${incomeReportYear}-${getFilingKey(matchedClient)}`;
        nextUploads[key] = {
          ...parsed,
          fileName: file.name,
          importedAt: new Date().toISOString(),
        };
        imported += 1;
      }

      setIncomeReportUploads(nextUploads);
      persistSharedState("incomeReportUploads", nextUploads);
      setMessage(`종소세 신고서 일괄 업로드 완료: 반영 ${imported}건, 거래처 매칭 실패 ${unmatched}건`);
    } catch (error) {
      setMessage(`종소세 신고서 일괄 업로드 실패: ${error.message || "PDF 형식을 확인해주세요."}`);
    } finally {
      setIncomeReportParsing(false);
    }
  }

  async function importIncomeExpenseRates(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage("기준/단순경비율 파일을 읽는 중입니다.");

    try {
      const rows = await parseUploadedRows(file);
      const rates = rows.map(normalizeExpenseRateRow).filter(Boolean);
      const uniqueRates = Array.from(new Map(rates.map((rate) => [rate.code, rate])).values());

      if (uniqueRates.length === 0) {
        setMessage("업종코드를 찾지 못했습니다. 국세청 기준/단순경비율 엑셀 파일인지 확인해주세요.");
        return;
      }

      setIncomeExpenseRates(uniqueRates);
      persistSharedState("incomeExpenseRates", uniqueRates);
      setMessage(`기준/단순경비율 ${uniqueRates.length}개 업종을 불러왔습니다.`);
    } catch (error) {
      setMessage(`기준/단순경비율 파일을 읽지 못했습니다: ${error.message || "파일 형식을 확인해주세요."}`);
    }
  }

  function saveIncomeReport() {
    if (!selectedIncomeReportClient || !incomeReportNoteKey) return;
    const client = normalizeClient(selectedIncomeReportClient);
    const savedAt = new Date().toISOString();
    const report = {
      id: `${incomeReportNoteKey}-${Date.now()}`,
      year: incomeReportYear,
      clientId: selectedIncomeReportClient.id,
      clientKey: incomeReportClientKey,
      companyName: client.company_name,
      ownerName: client.owner_name,
      savedAt,
      upload: incomeReportUpload,
      notes: currentIncomeReportNotes,
      totals: {
        revenueTotal: incomeReportUpload.revenueTotal || "",
        expenseTotal: incomeReportUpload.expenseTotal || "",
        totalIncome: getIncomeReportValue("totalIncome", "income_amount"),
        taxBase: incomeReportUpload.taxBase || "",
        determinedTax: incomeReportUpload.determinedTax || incomeReportDetails.global_income_tax || "",
        prepaidTax: incomeReportUpload.prepaidTax || incomeReportDetails.pre_notice || "",
        payableTax: incomeReportUpload.payableTax || "",
        dueTax: incomeReportUpload.dueTax || incomeReportDetails.global_income_tax || "",
        taxTotal: formatSignedNumberWithCommas(incomeReportTaxTotal),
        incomeRate: formatRate(incomeReportIncomeRate),
        businessRows: incomeReportBusinessRows.map((row) => ({
          code: row.code,
          industryName: row.industryName,
          revenue: formatSignedNumberWithCommas(row.revenue),
          expense: formatSignedNumberWithCommas(row.expense),
          income: formatSignedNumberWithCommas(row.income),
          incomeRate: formatRate(row.incomeRate),
          referenceRate: formatRate(row.referenceRate),
          referenceSource: row.referenceSource,
          gap: row.referenceRate ? `${row.gap > 0 ? "+" : ""}${row.gap.toFixed(1)}%p` : "",
        })),
      },
    };

    setIncomeReportSavedReports((prev) => {
      const next = {
        ...prev,
        [incomeReportNoteKey]: report,
      };

      persistSharedState("incomeReportSavedReports", next);
      return next;
    });

    setMessage(`${client.company_name} 종소세 보고서를 저장했습니다.`);
  }

  function deleteIncomeReportForClient() {
    if (!incomeReportNoteKey || !selectedIncomeReportClient) return;
    const client = normalizeClient(selectedIncomeReportClient);
    const confirmed = window.confirm(`"${client.company_name}" 보고서를 삭제할까요? 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    const nextSavedReports = Object.fromEntries(
      Object.entries(incomeReportSavedReports).filter(([key]) => key !== incomeReportNoteKey),
    );
    const nextUploads = Object.fromEntries(
      Object.entries(incomeReportUploads).filter(([key]) => key !== incomeReportNoteKey),
    );
    const nextNotes = Object.fromEntries(
      Object.entries(incomeReportNotes).filter(([key]) => key !== incomeReportNoteKey),
    );

    setIncomeReportSavedReports(nextSavedReports);
    setIncomeReportUploads(nextUploads);
    setIncomeReportNotes(nextNotes);
    persistSharedState("incomeReportSavedReports", nextSavedReports);
    persistSharedState("incomeReportUploads", nextUploads);
    persistSharedState("incomeReportNotes", nextNotes);
    setMessage(`"${client.company_name}" 보고서를 삭제했습니다.`);
  }

  function deleteIncomeReportsForYear() {
    const confirmed = window.confirm(`${incomeReportYear} 귀속 저장 보고서를 모두 삭제할까요? 삭제하면 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    const prefix = `${incomeReportYear}-`;
    const nextSavedReports = Object.fromEntries(
      Object.entries(incomeReportSavedReports).filter(([key]) => !key.startsWith(prefix)),
    );
    const nextUploads = Object.fromEntries(
      Object.entries(incomeReportUploads).filter(([key]) => !key.startsWith(prefix)),
    );

    setIncomeReportSavedReports(nextSavedReports);
    setIncomeReportUploads(nextUploads);
    persistSharedState("incomeReportSavedReports", nextSavedReports);
    persistSharedState("incomeReportUploads", nextUploads);
    setMessage(`${incomeReportYear} 귀속 종소세 보고서 저장본을 삭제했습니다.`);
  }

  function downloadIncomeReportsCsv() {
    const reports = Object.values(incomeReportSavedReports).filter((report) => String(report.year) === String(incomeReportYear));
    const headers = ["연도", "거래처", "대표자", "저장일", "업종코드", "세분류 업종명", "총수입금액", "필요경비", "소득금액", "업체 소득률", "기준 소득률", "기준", "차이", "과세표준", "결정세액", "기납부세액", "납부/환급세액", "파일명"];
    const rows = reports.map((report) => [
      report.year,
      report.companyName,
      report.ownerName,
      report.savedAt ? new Date(report.savedAt).toLocaleString("ko-KR") : "",
      "",
      "",
      report.totals?.revenueTotal || report.upload?.revenueTotal || "",
      report.totals?.expenseTotal || report.upload?.expenseTotal || "",
      report.totals?.totalIncome || report.upload?.totalIncome || "",
      report.totals?.incomeRate || "",
      "",
      "전체",
      "",
      report.totals?.taxBase || report.upload?.taxBase || "",
      report.totals?.determinedTax || report.upload?.determinedTax || "",
      report.totals?.prepaidTax || report.upload?.prepaidTax || "",
      report.totals?.taxTotal || report.upload?.dueTax || "",
      report.upload?.fileName || "",
    ]).flatMap((summaryRow, index) => {
      const report = reports[index];
      const businessRows = report.totals?.businessRows || [];
      return [
        summaryRow,
        ...businessRows.map((row) => [
          report.year,
          report.companyName,
          report.ownerName,
          report.savedAt ? new Date(report.savedAt).toLocaleString("ko-KR") : "",
          row.code,
          row.industryName,
          row.revenue,
          row.expense,
          row.income,
          row.incomeRate,
          row.referenceRate,
          row.referenceSource,
          row.gap,
          "",
          "",
          "",
          "",
          report.upload?.fileName || "",
        ]),
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
    downloadTextFile(`종소세_보고서_${incomeReportYear}.csv`, `\uFEFF${csv}`);
  }

  const savedIncomeReportsForYear = useMemo(
    () => Object.values(incomeReportSavedReports).filter((report) => String(report.year) === String(incomeReportYear)),
    [incomeReportSavedReports, incomeReportYear],
  );

  function printIncomeReportsBulk() {
    if (savedIncomeReportsForYear.length === 0) {
      setMessage("PDF로 저장할 보고서가 없습니다. 보고서 저장 후 다시 시도해주세요.");
      return;
    }

    setBulkPrintMode(true);
    setTimeout(() => window.print(), 100);
  }

  useEffect(() => {
    function closeBulkPrintMode() {
      setBulkPrintMode(false);
    }

    window.addEventListener("afterprint", closeBulkPrintMode);
    return () => window.removeEventListener("afterprint", closeBulkPrintMode);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadClients();
      loadHistories();
      loadSharedState();
    });
  }, []);

  return (
    <div className={`app-shell ${bulkPrintMode ? "bulk-printing" : ""}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">T</div>
          <div>
            <strong>TaxOffice Hub</strong>
            <span>거래처 관리</span>
          </div>
        </div>
        <nav className="side-nav">
          <div className="nav-group">
            <button
              className="nav-parent"
              type="button"
              onClick={() => setOpenMenus((prev) => ({ ...prev, clients: !prev.clients }))}
              aria-expanded={openMenus.clients}
            >
              <span>거래처 관리</span>
              <span>{openMenus.clients ? "⌃" : "⌄"}</span>
            </button>
            {openMenus.clients && (
              <div className="nav-children">
                <button className={activeView === "clients" ? "active" : ""} type="button" onClick={() => setActiveView("clients")}>거래처 목록</button>
                <button className={activeView === "joint" ? "active" : ""} type="button" onClick={() => setActiveView("joint")}>공동사업자 관리</button>
                <button className={activeView === "bookkeeping" ? "active" : ""} type="button" onClick={() => setActiveView("bookkeeping")}>기장진도현황</button>
              </div>
            )}
          </div>
          <div className="nav-group">
            <button
              className="nav-parent"
              type="button"
              onClick={() => setOpenMenus((prev) => ({ ...prev, filings: !prev.filings }))}
              aria-expanded={openMenus.filings}
            >
              <span>신고진도현황</span>
              <span>{openMenus.filings ? "⌃" : "⌄"}</span>
            </button>
            {openMenus.filings && (
              <div className="nav-children">
                {Object.entries(taxFilingTypes).map(([key, item]) => (
                  <button
                    className={activeView === "filing" && filingType === key ? "active" : ""}
                    key={key}
                    type="button"
                    onClick={() => openFilingView(key)}
                  >
                    {item.label}
                  </button>
                ))}
                <button className={activeView === "review" ? "active" : ""} type="button" onClick={() => setActiveView("review")}>신고 검토</button>
                <button className={activeView === "corrections" ? "active" : ""} type="button" onClick={() => setActiveView("corrections")}>수정신고 관리</button>
              </div>
            )}
          </div>
          <div className="nav-group">
            <button
              className="nav-parent"
              type="button"
              onClick={() => setOpenMenus((prev) => ({ ...prev, reports: !prev.reports }))}
              aria-expanded={openMenus.reports}
            >
              <span>보고서</span>
              <span>{openMenus.reports ? "⌃" : "⌄"}</span>
            </button>
            {openMenus.reports && (
              <div className="nav-children">
                <button className={activeView === "income-report" ? "active" : ""} type="button" onClick={() => setActiveView("income-report")}>종소세 결산 보고서</button>
              </div>
            )}
          </div>
          <div className="nav-group">
            <button
              className="nav-parent"
              type="button"
              onClick={() => setOpenMenus((prev) => ({ ...prev, statements: !prev.statements }))}
              aria-expanded={openMenus.statements}
            >
              <span>지급명세서</span>
              <span>{openMenus.statements ? "⌃" : "⌄"}</span>
            </button>
            {openMenus.statements && (
              <div className="nav-children">
                {Object.entries(paymentStatementTypes).map(([key, item]) => (
                  <button
                    className={activeView === "statement" && statementType === key ? "active" : ""}
                    key={key}
                    type="button"
                    onClick={() => openStatementView(key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="side-summary">
          <span>등록 거래처</span>
          <strong>{clients.length}곳</strong>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p>{sharedStorageReady ? "Supabase 공용 저장 완료" : "Supabase 연결 완료"}</p>
            <h1>거래처 관리</h1>
          </div>
          <div className="header-actions">
            <button className="primary-button" type="button" onClick={openCreateForm}>신규 거래처</button>
            <button className="secondary-button" type="button" onClick={openImportForm}>일괄 업로드</button>
            <button className="secondary-button" onClick={loadClients} disabled={loading}>새로고침</button>
          </div>
        </header>

        {message && <div className="notice">{message}</div>}

        {showImport && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-panel import-panel" role="dialog" aria-modal="true" aria-labelledby="import-title">
              <div className="panel-header">
                <div>
                  <h2 id="import-title">거래처 일괄 업로드</h2>
                  <p>사업자번호가 이미 있으면 기존 거래처를 업데이트하고, 없으면 새로 등록합니다.</p>
                </div>
                <button className="icon-button" type="button" onClick={closeImportForm} aria-label="닫기">×</button>
              </div>
              <div className="import-box">
                <label className="file-drop">
                  <span>CSV 파일 선택</span>
                  <strong>세무대리 마스터 변환 파일을 선택하세요.</strong>
                  <input type="file" accept=".csv,text/csv" onChange={importClientsFromCsv} disabled={saving} />
                </label>
                <a className="text-button" href="/client-import-safe.csv" download>변환된 CSV 다운로드</a>
              </div>
              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeImportForm} disabled={saving}>닫기</button>
              </div>
            </section>
          </div>
        )}

        {showForm && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
              <div className="panel-header">
                <h2 id="client-form-title">{editingId ? "거래처 정보 수정" : "신규 거래처 등록"}</h2>
                <button className="icon-button" type="button" onClick={cancelEdit} aria-label="닫기">×</button>
              </div>

              <form onSubmit={saveClient} className="client-form">
                <label>
                  <span>업체명</span>
                  <input name="company_name" value={form.company_name} onChange={changeForm} placeholder="예: 은비상회" />
                </label>
                <label>
                  <span>사업자번호</span>
                  <input name="business_number" value={form.business_number} onChange={changeForm} placeholder="000-00-00000" inputMode="numeric" />
                </label>
                <label>
                  <span>주민번호</span>
                  <input name="resident_number" value={form.resident_number} onChange={changeForm} placeholder="000000-0000000" inputMode="numeric" />
                </label>
                <label>
                  <span>대표자명</span>
                  <input name="owner_name" value={form.owner_name} onChange={changeForm} placeholder="대표자명" />
                </label>
                <label>
                  <span>연락처 1</span>
                  <input name="phone" value={form.phone} onChange={changeForm} placeholder="010-0000-0000" inputMode="numeric" />
                </label>
                {showSecondPhone ? (
                  <label>
                    <span>연락처 2</span>
                    <div className="inline-field">
                      <input name="phone2" value={form.phone2} onChange={changeForm} placeholder="010-0000-0000" inputMode="numeric" />
                      <button className="mini-button" type="button" onClick={removeSecondPhone}>삭제</button>
                    </div>
                  </label>
                ) : (
                  <div className="field-action">
                    <span>추가 연락처</span>
                    <button className="secondary-button" type="button" onClick={addSecondPhone}>연락처 추가</button>
                  </div>
                )}
                <label>
                  <span>메일주소</span>
                  <input name="email" type="email" value={form.email} onChange={changeForm} placeholder="name@example.com" />
                </label>
                <label>
                  <span>공동사업자 여부</span>
                  <label className="check-row">
                    <input name="is_joint_business" type="checkbox" checked={form.is_joint_business} onChange={changeForm} />
                    <span>공동사업자</span>
                  </label>
                </label>
                {(form.is_joint_business || wasJointBusiness) && (
                  <>
                    {form.is_joint_business && (
                      <>
                        <label>
                          <span>지분율(%)</span>
                          <input name="joint_share_ratio" value={form.joint_share_ratio} onChange={changeForm} placeholder="예: 50" inputMode="decimal" />
                        </label>
                        <label>
                          <span>공동대표 성함</span>
                          <input name="joint_owner_name" value={form.joint_owner_name} onChange={changeForm} placeholder="공동대표 성명" />
                        </label>
                        <label>
                          <span>공동대표 주민번호</span>
                          <input name="joint_resident_number" value={form.joint_resident_number} onChange={changeForm} placeholder="000000-0000000" inputMode="numeric" />
                        </label>
                        <label>
                          <span>공동사업자 시작일</span>
                          <input name="joint_start_date" type="date" value={form.joint_start_date} onChange={changeForm} />
                        </label>
                      </>
                    )}
                    <label>
                      <span>공동사업자 종료일</span>
                      <input name="joint_end_date" type="date" value={form.joint_end_date} onChange={changeForm} />
                    </label>
                  </>
                )}
                <label>
                  <span>법인/개인</span>
                  <select name="entity_type" value={form.entity_type} onChange={changeForm}>
                    <option>개인</option>
                    <option>법인</option>
                  </select>
                </label>
                <label>
                  <span>과세유형</span>
                  <select name="tax_type" value={form.tax_type} onChange={changeForm}>
                    <option>일반과세자</option>
                    <option>간이과세자</option>
                    <option>면세사업자</option>
                  </select>
                </label>
                <label>
                  <span>원천세 신고유형</span>
                  <select name="withholding_type" value={form.withholding_type} onChange={changeForm}>
                    <option>매월</option>
                    <option>반기</option>
                    <option>해당 없음</option>
                  </select>
                </label>
                <label>
                  <span>대리유형</span>
                  <select name="agency_type" value={form.agency_type} onChange={changeForm}>
                    <option>기장대리</option>
                    <option>신고대리</option>
                  </select>
                </label>
                <label>
                  <span>기장료</span>
                  <input name="bookkeeping_fee" value={form.bookkeeping_fee} onChange={changeForm} placeholder="예: 80000" inputMode="numeric" />
                </label>
                <label>
                  <span>계약일</span>
                  <input name="contract_date" type="date" value={form.contract_date} onChange={changeForm} />
                </label>
                <label>
                  <span>종료일</span>
                  <input name="end_date" type="date" value={form.end_date} onChange={changeForm} />
                </label>
                <label>
                  <span>상태</span>
                  <select name="status" value={form.status} onChange={changeForm}>
                    <option>계속</option>
                    <option>휴업</option>
                    <option>폐업</option>
                    <option>이관</option>
                  </select>
                </label>
                <label className="wide-field">
                  <span>비고</span>
                  <textarea name="memo" value={form.memo} onChange={changeForm} placeholder="공동사업자 변경, 이관 예정, 특이사항 등을 적어두세요." />
                </label>

                <div className="form-actions">
                  <button className="secondary-button" type="button" onClick={cancelEdit} disabled={saving}>취소</button>
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? "저장 중..." : editingId ? "수정 저장" : "신규 등록"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {activeView === "clients" && (
        <section className="panel list-panel">
          <div className="panel-header list-header">
            <div>
              <h2>거래처 목록</h2>
              <p>{filteredClients.length}건 표시 중 · 기장료 합계 {bookkeepingTotal.toLocaleString("ko-KR")}원</p>
            </div>
            <div className="table-tools">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업체명, 사업자번호, 대표자, 연락처, 메일 검색" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>전체</option>
                <option>계속</option>
                <option>휴업</option>
                <option>폐업</option>
                <option>이관</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="empty-text">불러오는 중...</p>
          ) : filteredClients.length === 0 ? (
            <p className="empty-text">조건에 맞는 거래처가 없습니다.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>업체명</th>
                    <th>사업자번호</th>
                    <th>대표자명</th>
                    <th>연락처</th>
                    <th>메일주소</th>
                    <th>공동사업자</th>
                    <th>법인/개인</th>
                    <th>과세유형</th>
                    <th>원천세 신고유형</th>
                    <th>대리유형</th>
                    <th>기장료</th>
                    <th>상태</th>
                    <th>비고</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const item = normalizeClient(client);
                    return (
                      <tr key={client.id}>
                        <td><strong>{item.company_name}</strong></td>
                        <td>{item.business_number}</td>
                        <td>{item.owner_name}</td>
                        <td>{[item.phone, item.phone2].filter(Boolean).join(" / ")}</td>
                        <td>{item.email}</td>
                        <td>{item.is_joint_business ? "여" : "부"}</td>
                        <td>{item.entity_type}</td>
                        <td>{item.tax_type}</td>
                        <td>{item.withholding_type}</td>
                        <td>{item.agency_type}</td>
                        <td>{item.bookkeeping_fee ? toNumber(item.bookkeeping_fee).toLocaleString("ko-KR") : "-"}</td>
                        <td><span className={`status ${item.status}`}>{item.status}</span></td>
                        <td className="memo-cell">{item.memo}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => startEdit(client)}>수정</button>
                            <button type="button" className="danger-button" onClick={() => deleteClient(client)}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}

        {activeView === "bookkeeping" && (
          <section className="panel list-panel">
            <div className="panel-header list-header">
              <div>
                <h2>거래처별 기장진도현황</h2>
                <p>{progressMonth} 기준 · {progressSummary.done}/{progressSummary.total} 완료 · {progressSummary.rate}%</p>
              </div>
              <div className="table-tools">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업체명, 사업자번호, 대표자 검색" />
                <input className="month-input" type="month" value={progressMonth} onChange={(event) => setProgressMonth(event.target.value)} />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option>전체</option>
                  <option>계속</option>
                  <option>휴업</option>
                  <option>폐업</option>
                  <option>이관</option>
                </select>
              </div>
            </div>

            <div className="progress-overview">
              <div>
                <span>완료율</span>
                <strong>{progressSummary.rate}%</strong>
              </div>
              <div className="progress-bar" aria-label="기장 완료율">
                <span style={{ width: `${progressSummary.rate}%` }} />
              </div>
            </div>

            <div className="progress-cards">
              {progressSummary.taskStats.map((stat) => (
                <div className="progress-card" key={stat.task}>
                  <span>{stat.task}</span>
                  <strong>{stat.done}/{stat.total}</strong>
                  <small>미완료 {stat.missing}건</small>
                </div>
              ))}
            </div>

            <details className="missing-box">
              <summary>미완료 거래처 {progressSummary.incompleteClients.length}곳 확인</summary>
              <div className="missing-list">
                {progressSummary.incompleteClients.length === 0 ? (
                  <p className="empty-text">모든 거래처의 기장 항목이 완료됐습니다.</p>
                ) : (
                  progressSummary.incompleteClients.slice(0, 80).map((client) => (
                    <div className="missing-item" key={client.id}>
                      <strong>{client.company_name}</strong>
                      <span>{client.missingTasks.join(", ")}</span>
                    </div>
                  ))
                )}
              </div>
            </details>

            {loading ? (
              <p className="empty-text">불러오는 중...</p>
            ) : activeClients.length === 0 ? (
              <p className="empty-text">표시할 거래처가 없습니다.</p>
            ) : (
              <div className="table-wrap">
                <table className="progress-table">
                  <thead>
                    <tr>
                      <th className="check-cell">
                        <input
                          className="table-checkbox"
                          type="checkbox"
                          checked={activeClients.length > 0 && activeClients.every((client) => getClientProgressCount(client) === bookkeepingTasks.length)}
                          onChange={toggleVisibleProgressAll}
                          aria-label="표시된 거래처 기장 항목 전체 적용"
                        />
                      </th>
                      <th>업체명</th>
                      <th>사업자번호</th>
                      {bookkeepingTasks.map((task) => (
                        <th key={task}>{task}</th>
                      ))}
                      <th>진도</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClients.map((client) => {
                      const item = normalizeClient(client);
                      const doneCount = getClientProgressCount(client);
                      const complete = doneCount === bookkeepingTasks.length;
                      return (
                        <tr key={client.id}>
                          <td className="check-cell">
                            <input
                              className="table-checkbox"
                              type="checkbox"
                              checked={complete}
                              onChange={() => toggleClientProgressAll(client)}
                              aria-label={`${item.company_name} 기장 항목 전체 적용`}
                            />
                          </td>
                          <td><strong>{item.company_name}</strong></td>
                          <td>{item.business_number}</td>
                          {bookkeepingTasks.map((task) => (
                            <td key={task} className="check-cell">
                              <button
                                className={`check-toggle ${getProgressValue(client, task) ? "checked" : ""}`}
                                type="button"
                                onClick={() => toggleProgress(client, task)}
                                aria-label={`${item.company_name} ${task}`}
                              >
                                {getProgressValue(client, task) ? "✓" : ""}
                              </button>
                            </td>
                          ))}
                          <td>
                            <span className={`status ${complete ? "계속" : "휴업"}`}>
                              {doneCount}/{bookkeepingTasks.length}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button type="button" onClick={() => startEdit(client)}>거래처 수정</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeView === "filing" && (
          <section className="panel list-panel">
            <div className="panel-header list-header">
              <div>
                <h2>신고진도현황</h2>
                <p>{filingPeriodKey} · {selectedFiling.label} · {filingSummary.done}/{filingSummary.total} 완료 · {filingSummary.rate}%</p>
              </div>
              <div className="table-tools">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업체명, 사업자번호, 대표자 검색" />
                {filingType === "withholding" ? (
                  <input className="month-input" type="month" value={filingMonth} onChange={(event) => setFilingMonth(event.target.value)} />
                ) : (
                  <select className="year-input" value={filingYear} onChange={(event) => setFilingYear(event.target.value)}>
                    {yearOptions.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </select>
                )}
                {filingType === "vat" && (
                  <select value={vatPeriod} onChange={(event) => setVatPeriod(event.target.value)}>
                    {vatPeriods.map((period) => (
                      <option key={period}>{period}</option>
                    ))}
                  </select>
                )}
                {filingType === "corporate" && (
                  <select value={corporateMode} onChange={(event) => setCorporateMode(event.target.value)}>
                    <option>정기신고</option>
                    <option>중간예납</option>
                  </select>
                )}
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option>전체</option>
                  <option>계속</option>
                  <option>휴업</option>
                  <option>폐업</option>
                  <option>이관</option>
                </select>
              </div>
            </div>

            <div className="filing-guide">
              <div>
                <span>대상 기준</span>
                <strong>{selectedFiling.description}</strong>
              </div>
              <div>
                <span>대상 거래처</span>
                <strong>
                  {filingClients.length}곳
                  {filingSummary.excluded ? ` · 제외 ${filingSummary.excluded}곳` : ""}
                </strong>
              </div>
              <div>
                <span>완료율</span>
                <strong>{filingSummary.rate}%</strong>
              </div>
            </div>

            {filingType === "withholding" && (
              <div className="withholding-note">
                <strong>원천세 금액 확인</strong>
                <span>소득 종류별 지급액과 소득세, 지방세를 나눠 입력해서 지급명세서와 대조합니다.</span>
              </div>
            )}

            {filingType === "vat" && (
              <div className="withholding-note">
                <strong>부가세 금액 확인</strong>
                <span>과세표준, 예정고지, 납부액을 입력하고 자료 수취부터 전자신고까지 진행합니다.</span>
              </div>
            )}

            {filingType === "income" && (
              <div className="withholding-note">
                <strong>종합소득세 금액 확인</strong>
                <span>신고유형과 소득금액, 세액, 조정료를 한 화면에서 관리합니다.</span>
              </div>
            )}

            {filingType === "corporate" && (
              <div className="withholding-note">
                <strong>법인세 {corporateMode}</strong>
                <span>
                  {corporateMode === "중간예납"
                    ? "중간예납세액을 입력하고 전자신고와 납부서 전달을 확인합니다."
                    : "과세표준, 소득금액, 세액, 조정료를 입력하고 전자신고 진행을 확인합니다."}
                </span>
              </div>
            )}

            <div className="progress-overview">
              <div>
                <span>신고 진행률</span>
                <strong>{filingSummary.rate}%</strong>
              </div>
              <div className="progress-bar" aria-label="신고 완료율">
                <span style={{ width: `${filingSummary.rate}%` }} />
              </div>
            </div>

            <div className="progress-cards filing-cards">
              {filingSummary.taskStats.map((stat) => (
                <div className="progress-card" key={stat.task}>
                  <span>{stat.task}</span>
                  <strong>{stat.done}/{stat.total}</strong>
                  <small>미완료 {stat.missing}건</small>
                </div>
              ))}
              {["income", "corporate"].includes(filingType) && (
                <div className="progress-card total-card">
                  <span>조정료 합계</span>
                  <strong>{filingSummary.adjustmentTotal.toLocaleString("ko-KR")}원</strong>
                  <small>{selectedFiling.label}</small>
                </div>
              )}
            </div>

            <details className="missing-box">
              <summary>미완료 거래처 {filingSummary.incompleteClients.length}곳 확인</summary>
              <div className="missing-list">
                {filingSummary.incompleteClients.length === 0 ? (
                  <p className="empty-text">모든 거래처의 신고 항목이 완료됐습니다.</p>
                ) : (
                  filingSummary.incompleteClients.slice(0, 80).map((client) => (
                    <div className="missing-item" key={client.id}>
                      <strong>{client.company_name}</strong>
                      <span>{client.missingTasks.join(", ")}</span>
                    </div>
                  ))
                )}
              </div>
            </details>

            {loading ? (
              <p className="empty-text">불러오는 중...</p>
            ) : filingClients.length === 0 ? (
              <p className="empty-text">선택한 신고 대상 거래처가 없습니다.</p>
            ) : (
              <div className="table-wrap">
                <table className={`progress-table filing-table ${filingType === "withholding" ? "withholding-table" : ""}`}>
                  <thead>
                    <tr>
                      <th className="check-cell">
                        <input
                          className="table-checkbox"
                          type="checkbox"
                          checked={
                            filingClients.filter((client) => !isFilingExcluded(client)).length > 0 &&
                            filingClients
                              .filter((client) => !isFilingExcluded(client))
                              .every((client) => getFilingProgressCount(client) === activeFilingTasks.length)
                          }
                          onChange={toggleVisibleFilingAll}
                          aria-label="표시된 신고 항목 전체 적용"
                        />
                      </th>
                      <th>업체명</th>
                      {["vat", "corporate"].includes(filingType) && <th>사업자번호</th>}
                      {filingType === "income" && <th>주민번호</th>}
                      {filingType === "income" && <th>신고유형</th>}
                      {filingType === "vat" && <th>과세유형</th>}
                      {filingType === "withholding" && <th>원천세</th>}
                      {filingType === "withholding" && <th>해당월 제외</th>}
                      {filingType === "withholding" && <th>지급액 합계</th>}
                      {filingType === "withholding" &&
                        withholdingTaxFields.map((field) => <th key={field.key}>{field.label}</th>)}
                      {filingType === "vat" && vatAmountFields.map((field) => <th key={field.key}>{field.label}</th>)}
                      {filingType === "income" && incomeAmountFields.map((field) => <th key={field.key}>{field.label}</th>)}
                      {filingType === "income" && <th>가경비</th>}
                      {filingType === "corporate" &&
                        activeCorporateAmountFields.map((field) => <th key={field.key}>{field.label}</th>)}
                      {activeFilingTasks.map((task) => (
                        <th key={task}>
                          <button
                            className="bulk-check"
                            type="button"
                            onClick={() => toggleFilingTaskForAll(task)}
                            title={`${task} 일괄 적용`}
                          >
                            {task}
                          </button>
                        </th>
                      ))}
                      <th>진도</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filingClients.map((client) => {
                      const item = normalizeClient(client);
                      const excluded = isFilingExcluded(client);
                      const filingKey = getFilingKey(client);
                      const detailOpen = Boolean(openWithholdingDetails[filingKey]);
                      const paymentTotal = getWithholdingPaymentTotal(client);
                      const doneCount = getFilingProgressCount(client);
                      const complete = doneCount === activeFilingTasks.length;
                      return (
                        <Fragment key={client.id}>
                          <tr className={excluded ? "excluded-row" : ""}>
                            <td className="check-cell">
                              <input
                                className="table-checkbox"
                                type="checkbox"
                                checked={!excluded && complete}
                                disabled={excluded}
                                onChange={() => toggleFilingClientAll(client)}
                                aria-label={`${item.company_name} 신고 항목 전체 적용`}
                              />
                            </td>
                            <td><strong>{item.company_name}</strong></td>
                            {["vat", "corporate"].includes(filingType) && <td>{item.business_number}</td>}
                            {filingType === "income" && <td>{item.resident_number}</td>}
                            {filingType === "income" && (
                              <td>
                                <select
                                  className="table-input filing-type-select"
                                  value={getFilingDetailValue(client, "income_filing_type") || "복식"}
                                  onChange={(event) => changeFilingDetail(client, "income_filing_type", event.target.value)}
                                  aria-label={`${item.company_name} 종합소득세 신고유형`}
                                >
                                  {incomeFilingTypes.map((type) => (
                                    <option key={type}>{type}</option>
                                  ))}
                                </select>
                              </td>
                            )}
                            {filingType === "vat" && <td>{item.tax_type}</td>}
                            {filingType === "withholding" && <td>{item.withholding_type}</td>}
                            {filingType === "withholding" && (
                              <td className="check-cell">
                                <input
                                  className="table-checkbox"
                                  type="checkbox"
                                  checked={excluded}
                                  onChange={() => toggleFilingExcluded(client)}
                                  aria-label={`${item.company_name} ${filingPeriodKey} 원천세 제외`}
                                />
                              </td>
                            )}
                            {filingType === "withholding" && (
                              <td className="amount-total">{paymentTotal ? paymentTotal.toLocaleString("ko-KR") : "-"}</td>
                            )}
                            {filingType === "withholding" &&
                              withholdingTaxFields.map((field) => (
                                <td key={field.key}>
                                  <input
                                    key={`${filingPeriodKey}-${filingType}-${filingKey}-${field.key}`}
                                    className="table-input amount-input"
                                    defaultValue={getFilingDetailValue(client, field.key)}
                                    onKeyDown={handleAmountKeyDown}
                                    onBlur={(event) => blurFilingAmount(client, field.key, event)}
                                    placeholder={field.placeholder}
                                    inputMode="decimal"
                                    aria-label={`${item.company_name} ${field.label}`}
                                  />
                                </td>
                              ))}
                            {filingType === "vat" &&
                              vatAmountFields.map((field) => (
                                <td key={field.key}>
                                  <input
                                    key={`${filingPeriodKey}-${filingType}-${filingKey}-${field.key}`}
                                    className="table-input amount-input"
                                    defaultValue={getFilingDetailValue(client, field.key)}
                                    onKeyDown={handleAmountKeyDown}
                                    onBlur={(event) => blurFilingAmount(client, field.key, event)}
                                    placeholder={field.placeholder}
                                    inputMode="decimal"
                                    aria-label={`${item.company_name} ${field.label}`}
                                  />
                                </td>
                              ))}
                            {filingType === "income" &&
                              incomeAmountFields.map((field) => (
                                <td key={field.key}>
                                  <input
                                    key={`${filingPeriodKey}-${filingType}-${filingKey}-${field.key}`}
                                    className="table-input amount-input"
                                    defaultValue={getFilingDetailValue(client, field.key)}
                                    onKeyDown={handleAmountKeyDown}
                                    onBlur={(event) => blurFilingAmount(client, field.key, event)}
                                    placeholder={field.placeholder}
                                    inputMode="decimal"
                                    aria-label={`${item.company_name} ${field.label}`}
                                  />
                                </td>
                              ))}
                            {filingType === "income" && (
                              <td className="check-cell">
                                <button
                                  className={`check-toggle ${getFilingValue(client, "가경비") ? "checked" : ""}`}
                                  type="button"
                                  onClick={() => toggleFilingProgress(client, "가경비")}
                                  aria-label={`${item.company_name} 종합소득세 가경비`}
                                >
                                  {getFilingValue(client, "가경비") ? "✓" : ""}
                                </button>
                              </td>
                            )}
                            {filingType === "corporate" &&
                              activeCorporateAmountFields.map((field) => (
                                <td key={field.key}>
                                  <input
                                    key={`${filingPeriodKey}-${filingType}-${filingKey}-${field.key}`}
                                    className="table-input amount-input"
                                    defaultValue={getFilingDetailValue(client, field.key)}
                                    onKeyDown={handleAmountKeyDown}
                                    onBlur={(event) => blurFilingAmount(client, field.key, event)}
                                    placeholder={field.placeholder}
                                    inputMode="decimal"
                                    aria-label={`${item.company_name} ${field.label}`}
                                  />
                                </td>
                              ))}
                            {activeFilingTasks.map((task) => (
                              <td key={task} className="check-cell">
                                <button
                                  className={`check-toggle ${getFilingValue(client, task) ? "checked" : ""}`}
                                  type="button"
                                  onClick={() => toggleFilingProgress(client, task)}
                                  disabled={excluded}
                                  aria-label={`${item.company_name} ${selectedFiling.label} ${task}`}
                                >
                                  {getFilingValue(client, task) ? "✓" : ""}
                                </button>
                              </td>
                            ))}
                            <td>
                              <span className={`status ${excluded ? "종료" : complete ? "계속" : "휴업"}`}>
                                {excluded ? "제외" : `${doneCount}/${activeFilingTasks.length}`}
                              </span>
                            </td>
                            <td>
                              <div className="row-actions">
                                {filingType === "withholding" && (
                                  <button type="button" onClick={() => toggleWithholdingDetail(client)}>
                                    {detailOpen ? "닫기" : "상세"}
                                  </button>
                                )}
                                <button type="button" onClick={() => startEdit(client)}>거래처 수정</button>
                              </div>
                            </td>
                          </tr>
                          {filingType === "withholding" && detailOpen && (
                            <tr className="detail-row">
                              <td colSpan={12}>
                                <div className="withholding-detail">
                                  <div className="detail-title">
                                    <strong>{item.company_name} 소득별 지급액</strong>
                                    <span>근로, 사업, 일용 등 지급명세서 대조용 금액입니다.</span>
                                  </div>
                                  <div className="detail-grid">
                                    {withholdingAmountFields.map((field) => (
                                      <label key={field.key}>
                                        <span>{field.label}</span>
                                        <input
                                          key={`${filingPeriodKey}-${filingType}-${filingKey}-${field.key}`}
                                          className="table-input amount-input"
                                          defaultValue={getFilingDetailValue(client, field.key)}
                                          onKeyDown={handleAmountKeyDown}
                                          onBlur={(event) => blurFilingAmount(client, field.key, event)}
                                          placeholder={field.placeholder}
                                          inputMode="decimal"
                                          aria-label={`${item.company_name} ${field.label}`}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeView === "review" && (
          <section className="panel list-panel">
            <div className="panel-header list-header">
              <div>
                <h2>신고 검토</h2>
                <p>{reviewPeriodKey} · 홈택스 자료와 신고 관리 금액을 대사합니다.</p>
              </div>
              <div className="table-tools">
                <select value={reviewType} onChange={(event) => setReviewType(event.target.value)}>
                  {Object.entries(taxFilingTypes).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
                {reviewType === "withholding" ? (
                  <input className="month-input" type="month" value={reviewMonth} onChange={(event) => setReviewMonth(event.target.value)} />
                ) : (
                  <select className="year-input" value={reviewYear} onChange={(event) => setReviewYear(event.target.value)}>
                    {yearOptions.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </select>
                )}
                {reviewType === "vat" && (
                  <select value={reviewVatPeriod} onChange={(event) => setReviewVatPeriod(event.target.value)}>
                    {vatPeriods.map((period) => (
                      <option key={period}>{period}</option>
                    ))}
                  </select>
                )}
                {reviewType === "corporate" && (
                  <select value={reviewCorporateMode} onChange={(event) => setReviewCorporateMode(event.target.value)}>
                    <option>정기신고</option>
                    <option>중간예납</option>
                  </select>
                )}
                <label className="secondary-button file-button">
                  홈택스 파일
                  <input type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importReviewRows} />
                </label>
              </div>
            </div>

            {reviewType === "withholding" && (
              <div className="withholding-note">
                <strong>원천세 반기 체크</strong>
                <span>반기 신고 거래처는 1월과 7월 검토에서만 표시합니다. 매칭은 사업자번호, 주민번호, 업체명 순서로 확인합니다.</span>
              </div>
            )}

            <div className="review-summary">
              <button
                className={reviewStatusFilter === "전체" ? "active" : ""}
                type="button"
                onClick={() => setReviewStatusFilter("전체")}
              >
                <span>홈택스 업로드</span>
                <strong>{reviewRows.length}건</strong>
              </button>
              <button
                className={reviewStatusFilter === "일치" ? "active" : ""}
                type="button"
                onClick={() => setReviewStatusFilter("일치")}
              >
                <span>일치</span>
                <strong>{reviewRowsByClient.filter((row) => ["일치", "접수 확인"].includes(row.status)).length}건</strong>
              </button>
              <button
                className={reviewStatusFilter === "차이" ? "active danger-card" : "danger-card"}
                type="button"
                onClick={() => setReviewStatusFilter("차이")}
              >
                <span>차이</span>
                <strong>{reviewRowsByClient.filter((row) => row.status === "차이").length}건</strong>
              </button>
              <button
                className={reviewStatusFilter === "홈택스 없음" ? "active missing-card" : "missing-card"}
                type="button"
                onClick={() => setReviewStatusFilter("홈택스 없음")}
              >
                <span>홈택스 없음</span>
                <strong>{missingHomeTaxRows.length}건</strong>
              </button>
            </div>

            <div className="table-wrap">
              <table className="review-table">
                <thead>
                  <tr>
                    <th>업체명</th>
                    <th>식별번호</th>
                    {(reviewFieldConfigs[reviewType] || []).map((field) => (
                      <Fragment key={field.key}>
                        <th>우리 {field.label}</th>
                        <th>홈택스 {field.label}</th>
                        <th>차이</th>
                      </Fragment>
                    ))}
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviewRows.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.item.company_name}</strong></td>
                      <td>{row.item.business_number || row.item.resident_number}</td>
                      {row.comparisons.map((field) => (
                        <Fragment key={field.key}>
                          <td className="amount-total">{field.appAmount.toLocaleString("ko-KR")}</td>
                          <td className="amount-total">{valueOrDash(field.homeTaxAmount)}</td>
                          <td className={field.matched ? "match-cell" : field.diff === null ? "amount-total" : "diff-cell"}>
                            {field.refundCarriedForward ? "환급 이월 일치" : field.matched ? "일치" : valueOrDash(field.diff)}
                          </td>
                        </Fragment>
                      ))}
                      <td><span className={`status ${getReviewStatusClass(row.status)}`}>{row.status}</span></td>
                    </tr>
                  ))}
                  {filteredReviewRows.length === 0 && (
                    <tr>
                      <td colSpan={(reviewFieldConfigs[reviewType] || []).length * 3 + 3} className="empty-text">
                        선택한 조건에 해당하는 거래처가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {missingHomeTaxRows.length > 0 && (
              <div className="review-missing">
                <div className="panel-header">
                  <div>
                    <h2>홈택스 없음 확인</h2>
                    <p>앱에는 신고 대상인데 홈택스 파일에서 매칭되지 않은 거래처입니다.</p>
                  </div>
                </div>
                <div className="table-wrap compact-table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>업체명</th>
                        <th>식별번호</th>
                        <th>확인 기준</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingHomeTaxRows.map((row) => (
                        <tr key={row.id}>
                          <td><strong>{row.item.company_name}</strong></td>
                          <td>{row.item.business_number || row.item.resident_number || "-"}</td>
                          <td>사업자번호, 주민번호, 업체명</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {activeView === "statement" && (
          <section className="panel list-panel">
            <div className="panel-header list-header">
              <div>
                <h2>지급명세서</h2>
                <p>{statementPeriodKey} · {selectedStatement.label} · 원천세 상세 입력자료 {statementRowsWithInput.length}건 기준</p>
              </div>
              <div className="table-tools">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업체명, 사업자번호, 대표자 검색" />
                {selectedStatement.periodType === "month" && (
                  <input className="month-input" type="month" value={statementMonth} onChange={(event) => setStatementMonth(event.target.value)} />
                )}
                {selectedStatement.periodType !== "month" && (
                  <select className="year-input" value={statementYear} onChange={(event) => setStatementYear(event.target.value)}>
                    {yearOptions.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </select>
                )}
                {selectedStatement.periodType === "half" && (
                  <select value={statementHalf} onChange={(event) => setStatementHalf(event.target.value)}>
                    <option>상반기</option>
                    <option>하반기</option>
                  </select>
                )}
                <label className="secondary-button file-button">
                  홈택스 파일
                  <input type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importStatementRows} />
                </label>
              </div>
            </div>

            <div className="withholding-note">
              <strong>원천세 자료 기준</strong>
              <span>원천세 화면에 입력한 {selectedStatement.label} 지급액을 기간별로 합산해서 홈택스 지급명세서 자료와 대조합니다.</span>
            </div>

            <div className="review-summary">
              <button
                className={statementStatusFilter === "전체" ? "active" : ""}
                type="button"
                onClick={() => setStatementStatusFilter("전체")}
              >
                <span>홈택스 업로드</span>
                <strong>{statementRows.length}건</strong>
              </button>
              <button
                className={statementStatusFilter === "일치" ? "active" : ""}
                type="button"
                onClick={() => setStatementStatusFilter("일치")}
              >
                <span>일치</span>
                <strong>{statementRowsWithInput.filter((row) => row.status === "일치").length}건</strong>
              </button>
              <button
                className={statementStatusFilter === "차이" ? "active danger-card" : "danger-card"}
                type="button"
                onClick={() => setStatementStatusFilter("차이")}
              >
                <span>차이</span>
                <strong>{statementRowsWithInput.filter((row) => row.status === "차이").length}건</strong>
              </button>
              <button
                className={statementStatusFilter === "홈택스 없음" ? "active missing-card" : "missing-card"}
                type="button"
                onClick={() => setStatementStatusFilter("홈택스 없음")}
              >
                <span>홈택스 없음</span>
                <strong>{statementRowsWithInput.filter((row) => row.status === "홈택스 없음").length}건</strong>
              </button>
            </div>

            <div className="table-wrap">
              <table className="review-table statement-table">
                <thead>
                  <tr>
                    <th>업체명</th>
                    <th>사업자번호</th>
                    <th>원천세</th>
                    <th>원천세 지급액</th>
                    <th>홈택스 지급액</th>
                    <th>차이</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatementReviewRows.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.item.company_name}</strong></td>
                      <td>{row.item.business_number || "-"}</td>
                      <td>{row.item.withholding_type}</td>
                      <td className="amount-total">{row.appAmount.toLocaleString("ko-KR")}</td>
                      <td className="amount-total">{valueOrDash(row.homeTaxAmount)}</td>
                      <td className={row.diff === 0 ? "match-cell" : row.diff === null ? "amount-total" : "diff-cell"}>
                        {row.diff === 0 ? "일치" : valueOrDash(row.diff)}
                      </td>
                      <td><span className={`status ${getReviewStatusClass(row.status)}`}>{row.status}</span></td>
                    </tr>
                  ))}
                  {filteredStatementReviewRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-text">
                        선택한 조건에 해당하는 거래처가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === "income-report" && (
          <section className="panel list-panel income-report-panel">
            <div className="panel-header list-header">
              <div>
                <h2>종소세 결산 보고서</h2>
                <p>{incomeReportYear} 귀속 · 올해 자료 기준으로 거래처 안내용 보고서 틀을 만듭니다.</p>
              </div>
              <div className="table-tools">
                <select className="year-input" value={incomeReportYear} onChange={(event) => setIncomeReportYear(event.target.value)}>
                  {yearOptions.map((year) => (
                    <option key={year}>{year}</option>
                  ))}
                </select>
                <select value={incomeReportClientKey} onChange={(event) => setIncomeReportClientId(event.target.value)}>
                  {incomeReportClients.length === 0 ? (
                    <option>개인 거래처 없음</option>
                  ) : (
                    incomeReportClients.map((client) => {
                      const item = normalizeClient(client);
                      return <option key={client.id} value={getFilingKey(client)}>{item.company_name}</option>;
                    })
                  )}
                </select>
                <label className="secondary-button file-button">
                  신고서 PDF
                  <input type="file" accept=".pdf,application/pdf" onChange={importIncomeReportPdf} disabled={incomeReportParsing} />
                </label>
                <label className="secondary-button file-button">
                  일괄 업로드
                  <input type="file" accept=".pdf,application/pdf" multiple onChange={importIncomeReportPdfs} disabled={incomeReportParsing} />
                </label>
                <label className="secondary-button file-button">
                  경비율 파일
                  <input type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importIncomeExpenseRates} />
                </label>
                <button className="primary-button" type="button" onClick={saveIncomeReport}>보고서 저장</button>
                <button className="secondary-button" type="button" onClick={printIncomeReportsBulk}>일괄 PDF</button>
                <button className="secondary-button" type="button" onClick={downloadIncomeReportsCsv}>CSV 다운</button>
                <button className="secondary-button danger-button" type="button" onClick={deleteIncomeReportForClient} disabled={!selectedIncomeReportClient}>선택 삭제</button>
                <button className="secondary-button danger-button" type="button" onClick={deleteIncomeReportsForYear}>연도 전체 삭제</button>
                <button className="secondary-button" type="button" onClick={() => window.print()}>인쇄</button>
              </div>
            </div>

            {!selectedIncomeReportClient ? (
              <p className="empty-text">종합소득세 보고서를 만들 개인 거래처가 없습니다.</p>
            ) : (
              <>
                <div className="report-summary-grid">
                  <div>
                    <span>신고서</span>
                    <strong>{incomeReportUpload.fileName ? "업로드 완료" : "미업로드"}</strong>
                  </div>
                  <div>
                    <span>종합소득금액</span>
                    <strong>{valueOrDash(toNumber(getIncomeReportValue("totalIncome", "income_amount")))}</strong>
                  </div>
                  <div>
                    <span>납부/환급세액</span>
                    <strong>{valueOrDash(incomeReportTaxTotal)}</strong>
                  </div>
                  <div>
                    <span>업체 소득률</span>
                    <strong>{formatRate(incomeReportIncomeRate)}</strong>
                  </div>
                  <div>
                    <span>사업/임대 업종</span>
                    <strong>{incomeReportBusinessRows.length ? `${incomeReportBusinessRows.length}개` : "-"}</strong>
                  </div>
                </div>

                {incomeReportUpload.fileName && (
                  <div className="withholding-note">
                    <strong>신고서 반영 완료</strong>
                    <span>{incomeReportUpload.fileName}에서 추출한 금액을 보고서에 우선 반영합니다.</span>
                  </div>
                )}

                <div className="saved-report-strip">
                  <div>
                    <span>저장 상태</span>
                    <strong>{savedIncomeReport ? "저장됨" : "아직 저장 전"}</strong>
                  </div>
                  <p>
                    {savedIncomeReport
                      ? `${new Date(savedIncomeReport.savedAt).toLocaleString("ko-KR")} 저장 · ${savedIncomeReport.companyName}`
                      : "PDF를 업로드하고 코멘트를 정리한 뒤 보고서 저장을 누르면 이 거래처 보고서가 Supabase에 저장됩니다."}
                  </p>
                </div>

                <div className="income-report-layout">
                  <div className="report-editor">
                    <h2>보고서 코멘트</h2>
                    <label>
                      <span>결산 요약</span>
                      <textarea
                        value={currentIncomeReportNotes.summary}
                        onChange={(event) => changeIncomeReportNote("summary", event.target.value)}
                        placeholder="예: 신고서 기준으로 총수입금액, 필요경비, 소득금액과 최종 납부/환급세액을 정리했습니다."
                      />
                    </label>
                    <label>
                      <span>소득률 비교 의견</span>
                      <textarea
                        value={currentIncomeReportNotes.comparison}
                        onChange={(event) => changeIncomeReportNote("comparison", event.target.value)}
                        placeholder="예: 사업/임대소득은 업종별 수입금액 대비 소득률을 기준으로 검토했습니다."
                      />
                    </label>
                    <div className="report-inline-fields">
                      <label>
                        <span>지방소득세</span>
                        <input
                          className="amount-input"
                          value={editableLocalIncomeTax}
                          onChange={(event) => changeIncomeReportNote("localIncomeTax", formatSignedNumberWithCommas(event.target.value))}
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </label>
                      <label>
                        <span>농특세</span>
                        <input
                          className="amount-input"
                          value={editableRuralTax}
                          onChange={(event) => changeIncomeReportNote("ruralTax", formatSignedNumberWithCommas(event.target.value))}
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </label>
                    </div>
                    <label>
                      <span>마무리 안내</span>
                      <textarea
                        value={currentIncomeReportNotes.closing}
                        onChange={(event) => changeIncomeReportNote("closing", event.target.value)}
                        placeholder="예: 신고는 완료되었으며, 환급 또는 납부 진행 상황은 별도 확인 후 안내드리겠습니다."
                      />
                    </label>
                    <div style={{ border: "1px solid #d0e8e4", borderRadius: 8, padding: "12px 14px", background: "#f7faf9", display: "grid", gap: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!currentIncomeReportNotes.showFee}
                          onChange={(event) => changeIncomeReportNote("showFee", event.target.checked)}
                        />
                        <strong style={{ fontSize: 13, color: "#0f4c45" }}>💰 수임료 보고서에 포함</strong>
                      </label>
                      <div className="report-inline-fields">
                        <label>
                          <span>조정료 <span style={{ color: "#7a9590", fontWeight: 400 }}>(자동: {formatSignedNumberWithCommas(autoFee)}원)</span></span>
                          <input
                            className="amount-input"
                            value={currentIncomeReportNotes.adjustmentFee}
                            onChange={(event) => changeIncomeReportNote("adjustmentFee", formatSignedNumberWithCommas(event.target.value))}
                            placeholder={String(autoFee)}
                            inputMode="decimal"
                            style={{ width: "100%" }}
                          />
                        </label>
                        <label>
                          <span>가산액</span>
                          <input
                            className="amount-input"
                            value={currentIncomeReportNotes.surcharge}
                            onChange={(event) => changeIncomeReportNote("surcharge", formatSignedNumberWithCommas(event.target.value))}
                            placeholder="0"
                            inputMode="decimal"
                            style={{ width: "100%" }}
                          />
                        </label>
                      </div>
                      <div className="report-inline-fields">
                        <label>
                          <span>가산 사유</span>
                          <input
                            style={{ width: "100%" }}
                            value={currentIncomeReportNotes.surchargeNote}
                            onChange={(event) => changeIncomeReportNote("surchargeNote", event.target.value)}
                            placeholder="예: 결산 10% 가산"
                          />
                        </label>
                        <label>
                          <span>할인액</span>
                          <input
                            className="amount-input"
                            value={currentIncomeReportNotes.discount}
                            onChange={(event) => changeIncomeReportNote("discount", formatSignedNumberWithCommas(event.target.value))}
                            placeholder="0"
                            inputMode="decimal"
                            style={{ width: "100%" }}
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, fontSize: 13, color: "#475569", borderTop: "1px solid #d0e8e4", paddingTop: 8 }}>
                        <span>부가세 {formatSignedNumberWithCommas(feeVat)}원</span>
                        <strong style={{ color: "#0f4c45", fontSize: 15 }}>합계 {formatSignedNumberWithCommas(feeTotal)}원</strong>
                      </div>
                      <label>
                        <span>입금 계좌번호</span>
                        <input
                          style={{ width: "100%" }}
                          value={currentIncomeReportNotes.bankAccount}
                          onChange={(event) => changeIncomeReportNote("bankAccount", event.target.value)}
                          placeholder="예: 국민은행 000000-00-000000"
                        />
                      </label>
                    </div>
                  </div>

                  <article className="report-preview">
                    <header>
                      <span>세무법인다승 · {incomeReportYear} 귀속</span>
                      <h2>종합소득세 결산 보고서</h2>
                      <p>{normalizeClient(selectedIncomeReportClient).company_name}</p>
                    </header>

                    <section>
                      <h3>1. 신고 개요</h3>
                      <dl>
                        <div>
                          <dt>신고유형</dt>
                          <dd>{incomeReportDetails.income_filing_type || "복식"}</dd>
                        </div>
                        <div>
                          <dt>총수입금액</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.revenueTotal))}원</dd>
                        </div>
                        <div>
                          <dt>필요경비</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.expenseTotal))}원</dd>
                        </div>
                        <div>
                          <dt>종합소득금액</dt>
                          <dd>{valueOrDash(toNumber(getIncomeReportValue("totalIncome", "income_amount")))}원</dd>
                        </div>
                        <div>
                          <dt>소득공제</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.incomeDeduction))}원</dd>
                        </div>
                        <div>
                          <dt>과세표준</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.taxBase))}원</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3>2. 소득 구성</h3>
                      <dl>
                        <div>
                          <dt>사업/임대소득</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.businessIncomeTotal))}원</dd>
                        </div>
                        <div>
                          <dt>그 외 종합소득</dt>
                          <dd>{valueOrDash(Math.max(0, toNumber(incomeReportUpload.totalIncome) - Math.max(0, toNumber(incomeReportUpload.businessIncomeTotal))))}원</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3>3. 세액 요약</h3>
                      <dl>
                        <div>
                          <dt>산출세액</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.calculatedTax))}원</dd>
                        </div>
                        <div>
                          <dt>세액감면/공제</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.taxCredit))}원</dd>
                        </div>
                        <div>
                          <dt>결정세액</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.determinedTax || incomeReportDetails.global_income_tax))}원</dd>
                        </div>
                        <div>
                          <dt>기납부세액</dt>
                          <dd>{valueOrDash(toNumber(incomeReportUpload.prepaidTax || incomeReportDetails.pre_notice))}원</dd>
                        </div>
                        <div>
                          <dt>지방소득세</dt>
                          <dd>{valueOrDash(toNumber(editableLocalIncomeTax))}원</dd>
                        </div>
                        <div>
                          <dt>농특세</dt>
                          <dd>{valueOrDash(toNumber(editableRuralTax))}원</dd>
                        </div>
                        <div className="report-tax-total">
                          <dt>납부/환급세액</dt>
                          <dd>{valueOrDash(incomeReportTaxTotal)}원</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3>4. 사업/임대 소득률 비교</h3>
                      {incomeReportBusinessRows.length === 0 ? (
                        <p>사업/임대소득 업종별 자료가 확인되지 않았습니다.</p>
                      ) : (
                        <div className="report-table-wrap">
                          <table className="report-mini-table">
                            <thead>
                              <tr>
                                <th>업종코드</th>
                                <th>세분류 업종명</th>
                                <th>수입금액</th>
                                <th>소득금액</th>
                                <th>업체 소득률</th>
                                <th>기준 소득률</th>
                                <th>차이</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incomeReportBusinessRows.map((row) => (
                                <tr key={row.code}>
                                  <td>{row.code}</td>
                                  <td>{row.industryName || "-"}</td>
                                  <td>{valueOrDash(row.revenue)}</td>
                                  <td>{valueOrDash(row.income)}</td>
                                  <td>{formatRate(row.incomeRate)}</td>
                                  <td>{row.referenceRate ? formatRate(row.referenceRate) : "-"}</td>
                                  <td>{row.referenceRate ? `${row.gap > 0 ? "+" : ""}${row.gap.toFixed(1)}%p` : "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p>{currentIncomeReportNotes.comparison || "사업/임대소득은 업종별 수입금액 대비 소득률을 기준으로 검토했습니다."}</p>
                    </section>

                    <section>
                      <h3>5. 마무리 안내</h3>
                      <p>{currentIncomeReportNotes.closing || "신고서 기준 결산 내용과 최종 납부/환급세액을 위와 같이 안내드립니다."}</p>
                    </section>

                    {currentIncomeReportNotes.showFee && baseFee > 0 && (() => {
                      const displayBankAccount = currentIncomeReportNotes.bankAccount || "기업은행 038-137878-01-027";
                      return (
                      <section className="report-fee-section">
                        <h3>6. 수임료 안내</h3>
                        <dl className="report-fee-summary">
                          <div>
                            <dt>조정료</dt>
                            <dd>{formatSignedNumberWithCommas(baseFee)}원</dd>
                          </div>
                          {surchargeAmt > 0 && (
                            <div>
                              <dt>가산액{currentIncomeReportNotes.surchargeNote ? ` (${currentIncomeReportNotes.surchargeNote})` : ""}</dt>
                              <dd>+{formatSignedNumberWithCommas(surchargeAmt)}원</dd>
                            </div>
                          )}
                          {discountAmt > 0 && (
                            <div>
                              <dt>할인액</dt>
                              <dd>-{formatSignedNumberWithCommas(discountAmt)}원</dd>
                            </div>
                          )}
                          <div>
                            <dt>부가세 (10%)</dt>
                            <dd>{formatSignedNumberWithCommas(feeVat)}원</dd>
                          </div>
                          <div className="report-fee-total">
                            <dt>합계 (VAT 포함)</dt>
                            <dd>{formatSignedNumberWithCommas(feeTotal)}원</dd>
                          </div>
                        </dl>
                        <p className="report-fee-bank">입금 계좌: <strong>{displayBankAccount}</strong></p>
                        <div className="fee-grid">
                          <div className="fee-grid-header">
                            <span>연매출액</span>
                            <span>계산식</span>
                            <span>비고사항</span>
                          </div>
                          {[
                            ["1억 미만",     "400,000원",                    "원가계산 시 20% 가산"],
                            ["1억 ~ 3억",    "400,000 + 초과액 × 0.20%",    ""],
                            ["3억 ~ 5억",    "800,000 + 초과액 × 0.10%",    "결산 함께 수행 시 10% 가산"],
                            ["5억 ~ 10억",   "1,000,000 + 초과액 × 0.05%",  "결산 함께 수행 시 10% 가산"],
                            ["10억 ~ 30억",  "1,250,000 + 초과액 × 0.04%",  "특수업종(임대·숙박·병의원·학원) 30% 가산"],
                            ["30억 ~ 50억",  "2,050,000 + 초과액 × 0.03%",  "특수업종(임대·숙박·병의원·학원) 30% 가산"],
                            ["50억 ~ 100억", "2,650,000 + 초과액 × 0.02%",  "특수업종(임대·숙박·병의원·학원) 30% 가산"],
                            ["100억 ~ 500억","3,650,000 + 초과액 × 0.01%",  "복수소득·복수업종 건당 10% 가산 (금융소득 30%)"],
                            ["500억 이상",   "7,650,000 + 초과액 × 0.005%", "복수소득·복수업종 건당 10% 가산 (금융소득 30%)"],
                          ].map(([range, formula, note], idx, arr) => {
                            const current = isCurrentTier(incomeReportRevenue, range);
                            const showNote = note && arr.findIndex(([,,n]) => n === note) === idx;
                            return (
                              <div key={range} className={`fee-grid-row${current ? " fee-grid-current" : ""}`}>
                                <span>{range}</span>
                                <span>{formula}</span>
                                <span>{showNote ? note : ""}</span>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                      );
                    })()}
                  </article>
                </div>
              </>
            )}
          </section>
        )}

        {activeView === "corrections" && (
          <section className="panel list-panel">
            <div className="panel-header list-header">
              <div>
                <h2>수정신고 관리</h2>
                <p>정기 신고 진행률과 분리해서 수정신고 건별 상태를 관리합니다.</p>
              </div>
            </div>

            <form className="correction-form" onSubmit={saveCorrection}>
              <div className="correction-row correction-row-main">
                <input name="company_name" value={correctionForm.company_name} onChange={changeCorrectionForm} placeholder="업체명" />
                <select name="filing_kind" value={correctionForm.filing_kind} onChange={changeCorrectionForm}>
                  <option>부가세</option>
                  <option>종합소득세</option>
                  <option>법인세</option>
                  <option>원천세</option>
                </select>
                <input name="period" value={correctionForm.period} onChange={changeCorrectionForm} placeholder="귀속기간" />
                <input name="reason" value={correctionForm.reason} onChange={changeCorrectionForm} placeholder="수정 사유" />
                <input name="tax_difference" value={correctionForm.tax_difference} onChange={changeCorrectionForm} placeholder="국세 증감액" inputMode="text" />
                <input name="local_tax_difference" value={correctionForm.local_tax_difference} onChange={changeCorrectionForm} placeholder="지방세 증감액" inputMode="text" />
              </div>
              <div className="correction-row correction-row-sub">
                <select name="status" value={correctionForm.status} onChange={changeCorrectionForm}>
                  <option>진행</option>
                  <option>완료</option>
                  <option>보류</option>
                </select>
                <label className="check-row compact-check">
                  <input name="efile_done" type="checkbox" checked={correctionForm.efile_done} onChange={changeCorrectionForm} />
                  <span>전자신고</span>
                </label>
                <label className="check-row compact-check">
                  <input name="payment_notice_done" type="checkbox" checked={correctionForm.payment_notice_done} onChange={changeCorrectionForm} />
                  <span>납부서 전달</span>
                </label>
                <input name="memo" value={correctionForm.memo} onChange={changeCorrectionForm} placeholder="메모" />
                <button className="primary-button" type="submit">{editingCorrectionId ? "수정 저장" : "추가"}</button>
                {editingCorrectionId && <button className="secondary-button" type="button" onClick={cancelCorrectionEdit}>취소</button>}
              </div>
            </form>

            {correctionItems.length === 0 ? (
              <p className="empty-text">등록된 수정신고 건이 없습니다.</p>
            ) : (
              <div className="table-wrap">
                <table className="correction-table">
                  <thead>
                    <tr>
                      <th>업체명</th>
                      <th>신고종류</th>
                      <th>귀속기간</th>
                      <th>사유</th>
                      <th>국세 증감액</th>
                      <th>지방세 증감액</th>
                      <th>전자신고</th>
                      <th>납부서 전달</th>
                      <th>상태</th>
                      <th>메모</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionItems.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.company_name}</strong></td>
                        <td>{item.filing_kind}</td>
                        <td>{item.period}</td>
                        <td>{item.reason}</td>
                        <td>{item.tax_difference || "-"}</td>
                        <td>{item.local_tax_difference || "-"}</td>
                        <td>{item.efile_done ? "완료" : "-"}</td>
                        <td>{item.payment_notice_done ? "완료" : "-"}</td>
                        <td><span className={`status ${item.status === "완료" ? "계속" : item.status === "보류" ? "이관" : "휴업"}`}>{item.status}</span></td>
                        <td className="memo-cell">{item.memo}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => editCorrection(item)}>수정</button>
                            <button className="danger-button" type="button" onClick={() => deleteCorrection(item.id)}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeView === "joint" && (
          <section className="panel list-panel">
            <div className="panel-header list-header">
              <div>
                <h2>공동사업자 관리</h2>
                <p>현재/종료 공동사업자 {jointClients.length}건 표시 중</p>
              </div>
              <div className="table-tools">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업체명, 공동대표, 주민번호 검색" />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option>전체</option>
                  <option>계속</option>
                  <option>휴업</option>
                  <option>폐업</option>
                  <option>이관</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="empty-text">불러오는 중...</p>
            ) : jointClients.length === 0 ? (
              <p className="empty-text">공동사업자로 등록된 거래처가 없습니다.</p>
            ) : (
              <div className="table-wrap">
                <table className="joint-table">
                  <thead>
                    <tr>
                      <th>업체명</th>
                      <th>사업자번호</th>
                      <th>구분</th>
                      <th>대표자명</th>
                      <th>대표자 주민번호</th>
                      <th>공동대표 성함</th>
                      <th>공동대표 주민번호</th>
                      <th>지분율</th>
                      <th>시작일</th>
                      <th>종료일</th>
                      <th>상태</th>
                      <th>비고</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jointClients.map((client) => {
                      const item = normalizeClient(client);
                      return (
                        <tr key={client.id}>
                          <td><strong>{item.company_name}</strong></td>
                          <td>{item.business_number}</td>
                          <td>
                            <span className={`status ${item.is_joint_business ? "진행" : "종료"}`}>
                              {item.is_joint_business ? "현재" : "종료"}
                            </span>
                          </td>
                          <td>{item.owner_name}</td>
                          <td>{item.resident_number}</td>
                          <td>{item.joint_owner_name}</td>
                          <td>{item.joint_resident_number}</td>
                          <td>{item.joint_share_ratio ? `${item.joint_share_ratio}%` : "-"}</td>
                          <td>{item.joint_start_date || "-"}</td>
                          <td>{item.joint_end_date || "-"}</td>
                          <td><span className={`status ${item.status}`}>{item.status}</span></td>
                          <td className="memo-cell">{item.memo}</td>
                          <td>
                            <div className="row-actions">
                              <button type="button" onClick={() => startEdit(client)}>수정</button>
                              <button type="button" className="danger-button" onClick={() => deleteClient(client)}>삭제</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="history-section">
              <div className="panel-header">
                <div>
                  <h2>공동사업자 변경 이력</h2>
                  <p>한 번 저장한 변경 내용을 한 줄로 묶어서 보여줍니다.</p>
                </div>
              </div>
              {groupedHistories.length === 0 ? (
                <p className="empty-text">아직 변경 이력이 없습니다.</p>
              ) : (
                <div className="table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>변경일</th>
                        <th>업체명</th>
                        <th>구분</th>
                        <th>변경 내용</th>
                        <th>비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedHistories.map((history) => (
                        <tr key={history.id}>
                          <td>{history.changed_at ? new Date(history.changed_at).toLocaleString("ko-KR") : "-"}</td>
                          <td><strong>{history.company_name}</strong></td>
                          <td>{history.type}</td>
                          <td className="memo-cell history-summary">{history.summary}</td>
                          <td className="memo-cell">{history.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="bulk-print-area" aria-hidden={!bulkPrintMode}>
          {savedIncomeReportsForYear.map((report) => (
            <article className="report-preview bulk-report-page" key={report.id || `${report.year}-${report.clientKey}`}>
              <header>
                <span>세무법인다승 · {report.year} 귀속</span>
                <h2>종합소득세 결산 보고서</h2>
                <p>{report.companyName}</p>
              </header>
              <section>
                <h3>1. 신고 개요</h3>
                <dl>
                  <div>
                    <dt>총수입금액</dt>
                    <dd>{valueOrDash(toNumber(report.totals?.revenueTotal || report.upload?.revenueTotal))}원</dd>
                  </div>
                  <div>
                    <dt>필요경비</dt>
                    <dd>{valueOrDash(toNumber(report.totals?.expenseTotal || report.upload?.expenseTotal))}원</dd>
                  </div>
                  <div>
                    <dt>종합소득금액</dt>
                    <dd>{valueOrDash(toNumber(report.totals?.totalIncome || report.upload?.totalIncome))}원</dd>
                  </div>
                  <div>
                    <dt>과세표준</dt>
                    <dd>{valueOrDash(toNumber(report.totals?.taxBase || report.upload?.taxBase))}원</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>2. 세액 요약</h3>
                <dl>
                  <div>
                    <dt>결정세액</dt>
                    <dd>{valueOrDash(toNumber(report.totals?.determinedTax || report.upload?.determinedTax))}원</dd>
                  </div>
                  <div>
                    <dt>기납부세액</dt>
                    <dd>{valueOrDash(toNumber(report.totals?.prepaidTax || report.upload?.prepaidTax))}원</dd>
                  </div>
                  <div>
                    <dt>납부/환급세액</dt>
                    <dd>{valueOrDash(toNumber(report.totals?.taxTotal || report.upload?.dueTax))}원</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>3. 사업/임대 소득률 비교</h3>
                {(report.totals?.businessRows || []).length === 0 ? (
                  <p>사업/임대소득 업종별 자료가 확인되지 않았습니다.</p>
                ) : (
                  <div className="report-table-wrap">
                    <table className="report-mini-table">
                      <thead>
                        <tr>
                          <th>업종코드</th>
                          <th>세분류 업종명</th>
                          <th>수입금액</th>
                          <th>소득금액</th>
                          <th>업체 소득률</th>
                          <th>기준 소득률</th>
                          <th>차이</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.totals?.businessRows || []).map((row) => (
                          <tr key={`${report.id}-${row.code}`}>
                            <td>{row.code}</td>
                            <td>{row.industryName || "-"}</td>
                            <td>{row.revenue || "-"}</td>
                            <td>{row.income || "-"}</td>
                            <td>{row.incomeRate || "-"}</td>
                            <td>{row.referenceRate ? `${row.referenceRate} ${row.referenceSource ? `(${row.referenceSource})` : ""}` : "-"}</td>
                            <td>{row.gap || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section>
                <h3>4. 검토 의견</h3>
                <p>{report.notes?.summary || "신고서 기준으로 종합소득세 결산 내용을 정리했습니다."}</p>
                <p>{report.notes?.comparison || "사업/임대소득은 업종별 수입금액 대비 소득률을 기준으로 검토했습니다."}</p>
                <p>{report.notes?.closing || "신고서 기준 결산 내용과 최종 납부/환급세액을 위와 같이 안내드립니다."}</p>
              </section>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;

