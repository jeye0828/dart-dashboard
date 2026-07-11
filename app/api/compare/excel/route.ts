import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { compareCompanies, type CompanyData } from "@/lib/compareService";
import { DartApiError } from "@/lib/dartClient";
import { RATIO_LABELS, GROWTH_LABELS } from "@/lib/ratios";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
const COMPANY_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203864" } };
const WHITE_BOLD_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
const BOLD_FONT: Partial<ExcelJS.Font> = { bold: true };

function fmt(v: unknown): string | number {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "number") return Math.round(v * 100) / 100;
  return String(v);
}

function autofit(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 32);
  });
}

function buildComparisonSheet(wb: ExcelJS.Workbook, companiesData: CompanyData[]) {
  const ws = wb.addWorksheet("비교표");
  const years = companiesData[0].periods.map((p) => p.period);

  ws.getCell(1, 1).value = "지표";
  let col = 2;
  for (const cd of companiesData) {
    const startCol = col;
    for (const year of years) {
      ws.getCell(2, col).value = year;
      col += 1;
    }
    const endCol = col - 1;
    ws.mergeCells(1, startCol, 1, endCol);
    const cell = ws.getCell(1, startCol);
    cell.value = cd.corpName;
    cell.font = WHITE_BOLD_FONT;
    cell.fill = COMPANY_FILL;
    cell.alignment = { horizontal: "center" };
  }
  for (let c = 1; c < col; c++) {
    const cell = ws.getCell(2, c);
    cell.font = BOLD_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center" };
  }

  let row = 3;
  for (const label of RATIO_LABELS) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = BOLD_FONT;
    col = 2;
    for (const cd of companiesData) {
      for (const ratioRow of cd.ratioRows) {
        ws.getCell(row, col).value = fmt(ratioRow[label]);
        col += 1;
      }
    }
    row += 1;
  }

  row += 1;
  ws.getCell(row, 1).value = "[ 성장성 (YoY, %) ]";
  ws.getCell(row, 1).font = BOLD_FONT;
  row += 1;

  const growthPeriods = companiesData[0].growthRows.map((g) => g.period);
  col = 2;
  for (const cd of companiesData) {
    for (const gp of growthPeriods) {
      ws.getCell(row, col).value = gp;
      col += 1;
    }
  }
  row += 1;

  for (const label of GROWTH_LABELS) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = BOLD_FONT;
    col = 2;
    for (const cd of companiesData) {
      for (const growthRow of cd.growthRows) {
        ws.getCell(row, col).value = fmt(growthRow[label]);
        col += 1;
      }
    }
    row += 1;
  }

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 2 }];
  autofit(ws);
}

const RAW_FIELDS: [string, keyof CompanyData["periods"][number]][] = [
  ["매출액", "revenue"],
  ["매출원가", "cogs"],
  ["영업이익", "operating_income"],
  ["당기순이익", "net_income"],
  ["이자비용/금융비용", "interest_expense"],
  ["자산총계", "total_assets"],
  ["유동자산", "current_assets"],
  ["재고자산", "inventory"],
  ["현금및현금성자산", "cash"],
  ["부채총계", "total_liabilities"],
  ["유동부채", "current_liabilities"],
  ["자본총계", "total_equity"],
  ["영업활동현금흐름", "operating_cash_flow"],
];

function buildCompanySheet(wb: ExcelJS.Workbook, cd: CompanyData, usedNames: Set<string>) {
  let title = (cd.corpName || cd.inputName).slice(0, 28);
  let suffix = 2;
  while (usedNames.has(title)) {
    title = `${(cd.corpName || cd.inputName).slice(0, 24)}(${suffix})`;
    suffix += 1;
  }
  usedNames.add(title);

  const ws = wb.addWorksheet(title);
  ws.getCell(1, 1).value = `${cd.corpName} (재무제표 기준: ${cd.fsDiv === "CFS" ? "연결" : "개별"})`;
  ws.getCell(1, 1).font = BOLD_FONT;

  let row = 3;
  ws.getCell(row, 1).value = "계정";
  ws.getCell(row, 1).font = BOLD_FONT;
  ws.getCell(row, 1).fill = HEADER_FILL;
  cd.periods.forEach((p, i) => {
    const cell = ws.getCell(row, i + 2);
    cell.value = p.period;
    cell.font = BOLD_FONT;
    cell.fill = HEADER_FILL;
  });
  row += 1;

  for (const [label, key] of RAW_FIELDS) {
    ws.getCell(row, 1).value = label;
    cd.periods.forEach((p, i) => {
      const v = p[key] as number | null;
      ws.getCell(row, i + 2).value = v !== null && v !== undefined ? Math.round(v) : "N/A";
    });
    row += 1;
  }

  row += 1;
  ws.getCell(row, 1).value = "[ 재무비율 ]";
  ws.getCell(row, 1).font = BOLD_FONT;
  row += 1;
  for (const label of RATIO_LABELS) {
    ws.getCell(row, 1).value = label;
    cd.ratioRows.forEach((rr, i) => {
      ws.getCell(row, i + 2).value = fmt(rr[label]);
    });
    row += 1;
  }

  row += 1;
  ws.getCell(row, 1).value = "[ 성장성 (YoY, %) ]";
  ws.getCell(row, 1).font = BOLD_FONT;
  row += 1;
  for (const label of GROWTH_LABELS) {
    ws.getCell(row, 1).value = label;
    cd.growthRows.forEach((gr, i) => {
      ws.getCell(row, i + 2).value = fmt(gr[label]);
    });
    row += 1;
  }

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 3 }];
  autofit(ws);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const companies: string[] = body?.companies ?? [];
  const year: number = body?.year;

  if (!Array.isArray(companies) || companies.length < 2) {
    return NextResponse.json({ error: "비교할 회사를 2개 이상 입력해주세요." }, { status: 400 });
  }
  if (!year || Number.isNaN(Number(year))) {
    return NextResponse.json({ error: "기준 연도를 지정해주세요." }, { status: 400 });
  }

  let companiesData: CompanyData[];
  try {
    companiesData = await compareCompanies(companies, Number(year));
  } catch (e) {
    const message = e instanceof DartApiError ? e.message : "비교 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();
  buildComparisonSheet(wb, companiesData);
  const usedNames = new Set<string>(["비교표"]);
  for (const cd of companiesData) {
    buildCompanySheet(wb, cd, usedNames);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="comparison.xlsx"`,
    },
  });
}
