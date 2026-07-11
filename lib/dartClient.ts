import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { ACCOUNT_MAP } from "./dartAccounts";
import type { Period } from "./ratios";

const API_BASE = "https://opendart.fss.or.kr/api";
const CORP_CACHE_MAX_AGE_MS = 7 * 24 * 3600 * 1000; // 7일

export class DartApiError extends Error {}

export interface Corp {
  corp_code: string;
  corp_name: string;
  stock_code: string;
}

// 서버리스 인스턴스가 살아있는 동안(warm) 재사용되는 모듈 레벨 캐시
let corpCache: { list: Corp[]; fetchedAt: number } | null = null;

export function getApiKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new DartApiError("DART_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return key;
}

async function downloadCorpCodeList(apiKey: string): Promise<Corp[]> {
  const res = await fetch(`${API_BASE}/corpCode.xml?crtfc_key=${apiKey}`);
  if (!res.ok) {
    throw new DartApiError(`corpCode.xml 요청 실패 (HTTP ${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("zip") && !contentType.includes("msdownload") && !contentType.includes("octet-stream")) {
    const parser = new XMLParser({ parseTagValue: false });
    const parsed = parser.parse(buf.toString("utf-8"));
    const status = parsed?.result?.status;
    const message = parsed?.result?.message;
    throw new DartApiError(`DART API 오류 (${status}): ${message}`);
  }

  const zip = await JSZip.loadAsync(buf);
  const xmlFile = zip.file("CORPCODE.xml");
  if (!xmlFile) throw new DartApiError("CORPCODE.xml을 zip에서 찾을 수 없습니다.");
  const xmlText = await xmlFile.async("text");

  const parser = new XMLParser({ parseTagValue: false });
  const parsed = parser.parse(xmlText);
  const items = parsed?.result?.list ?? [];
  const list: Corp[] = (Array.isArray(items) ? items : [items]).map((item: Record<string, unknown>) => ({
    corp_code: String(item.corp_code ?? "").trim(),
    corp_name: String(item.corp_name ?? "").trim(),
    stock_code: String(item.stock_code ?? "").trim(),
  }));
  return list;
}

export async function getCorpCodeList(apiKey: string): Promise<Corp[]> {
  const now = Date.now();
  if (corpCache && now - corpCache.fetchedAt < CORP_CACHE_MAX_AGE_MS) {
    return corpCache.list;
  }
  const list = await downloadCorpCodeList(apiKey);
  corpCache = { list, fetchedAt: now };
  return list;
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
