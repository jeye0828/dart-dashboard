import { ACCOUNT_MAP } from "./dartAccounts";
import type { Period } from "./ratios";
import corpCodesData from "./data/corpCodes.json";

const API_BASE = "https://opendart.fss.or.kr/api";

export class DartApiError extends Error {}

export interface Corp {
  corp_code: string;
  corp_name: string;
  stock_code: string;
}

// DART의 corpCode.xml(약 30MB 압축 파일)을 매 요청마다 내려받으면 응답이 매우 느려지므로,
// scripts/update-corp-codes.mjs로 미리 만들어둔 정적 목록을 번들에 포함해 즉시 사용한다.
const CORP_CODES: Corp[] = corpCodesData as Corp[];

export function getApiKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new DartApiError("DART_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return key;
}

export async function getCorpCodeList(): Promise<Corp[]> {
  return CORP_CODES;
}

export function searchCompany(name: string, corpList: Corp[]): Corp[] {
  const trimmed = name.trim();
  const exactListed: Corp[] = [];
  const exact: Corp[] = [];
  const containsListed: Corp[] = [];
  const contains: Corp[] = [];

  for (const c of corpList) {
    const isListed = Boolean(c.stock_code);
    if (c.corp_name === trimmed) {
      (isListed ? exactListed : exact).push(c);
    } else if (trimmed && c.corp_name.includes(trimmed)) {
      (isListed ? containsListed : contains).push(c);
    }
  }
  return [...exactListed, ...exact, ...containsListed, ...contains];
}

interface DartAccountRow {
  sj_div: string;
  account_nm: string;
  account_detail: string;
  thstrm_amount: string;
  frmtrm_amount: string;
  bfefrmtrm_amount: string;
}

export async function fetchFinancialRows(
  apiKey: string,
  corpCode: string,
  baseYear: number,
  reprtCode = "11011"
): Promise<{ rows: DartAccountRow[]; fsDiv: string | null }> {
  for (const fsDiv of ["CFS", "OFS"]) {
    const params = new URLSearchParams({
      crtfc_key: apiKey,
      corp_code: corpCode,
      bsns_year: String(baseYear),
      reprt_code: reprtCode,
      fs_div: fsDiv,
    });
    const res = await fetch(`${API_BASE}/fnlttSinglAcntAll.json?${params.toString()}`);
    if (!res.ok) throw new DartApiError(`재무제표 조회 실패 (HTTP ${res.status})`);
    const data = await res.json();
    if (data.status === "000") {
      return { rows: data.list ?? [], fsDiv };
    }
    if (data.status === "013") continue; // 조회된 데이터 없음 -> 다음 fs_div 시도
    throw new DartApiError(`DART API 오류 (${data.status}): ${data.message}`);
  }
  return { rows: [], fsDiv: null };
}

function normalize(name: string | undefined | null): string {
  return (name ?? "").replace(/\s/g, "");
}

function findAccount(rows: DartAccountRow[], sjDivs: string[], candidates: string[]): DartAccountRow | null {
  const normalizedCandidates = candidates.map(normalize);
  for (const target of normalizedCandidates) {
    for (const row of rows) {
      if (sjDivs.includes(row.sj_div) && normalize(row.account_nm) === target && (row.account_detail ?? "-") === "-") {
        return row;
      }
    }
  }
  return null;
}

function toNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

export function parseFinancials(rows: DartAccountRow[], baseYear: number): Period[] {
  const periodKeys: [keyof DartAccountRow, number][] = [
    ["bfefrmtrm_amount", baseYear - 2],
    ["frmtrm_amount", baseYear - 1],
    ["thstrm_amount", baseYear],
  ];

  const periods: Record<number, Period> = {};
  for (const [, year] of periodKeys) {
    periods[year] = { period: String(year) } as Period;
  }

  for (const [field, { sjDivs, candidates }] of Object.entries(ACCOUNT_MAP)) {
    const row = findAccount(rows, sjDivs, candidates);
    for (const [amountKey, year] of periodKeys) {
      (periods[year] as unknown as Record<string, number | null>)[field] = row
        ? toNumber(row[amountKey] as string)
        : null;
    }
  }

  return periodKeys.map(([, year]) => periods[year]);
}

export async function getCompanyPeriods(
  apiKey: string,
  corpCode: string,
  baseYear: number
): Promise<{ periods: Period[]; fsDiv: string | null }> {
  const { rows, fsDiv } = await fetchFinancialRows(apiKey, corpCode, baseYear);
  if (!rows.length) {
    throw new DartApiError("재무제표 데이터를 찾을 수 없습니다 (연결/개별 모두 없음).");
  }
  return { periods: parseFinancials(rows, baseYear), fsDiv };
}
