export interface Period {
  period: string;
  revenue: number | null;
  cogs: number | null;
  operating_income: number | null;
  net_income: number | null;
  interest_expense: number | null;
  total_assets: number | null;
  current_assets: number | null;
  inventory: number | null;
  cash: number | null;
  total_liabilities: number | null;
  current_liabilities: number | null;
  total_equity: number | null;
  operating_cash_flow: number | null;
}

export interface RatioRow {
  period: string;
  [label: string]: string | number | null;
}

export interface GrowthRow {
  period: string;
  [label: string]: string | number | null;
}

function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || !denominator) return null;
  return numerator / denominator;
}

export const RATIO_LABELS = [
  "매출총이익률(%)", "영업이익률(%)", "순이익률(%)", "ROA(%)", "ROE(%)",
  "유동비율(%)", "당좌비율(%)", "현금비율(%)", "부채비율(%)", "부채자산비율(%)",
  "이자보상배율(x)", "총자산회전율(x)", "영업현금흐름대비순이익(x)",
];

export const GROWTH_LABELS = [
  "revenue_성장률(%)", "operating_income_성장률(%)", "net_income_성장률(%)",
  "total_assets_성장률(%)", "total_equity_성장률(%)",
];

const PCT_KEYS = new Set([
  "매출총이익률(%)", "영업이익률(%)", "순이익률(%)", "ROA(%)", "ROE(%)",
  "유동비율(%)", "당좌비율(%)", "현금비율(%)", "부채비율(%)", "부채자산비율(%)",
]);

export function analyzePeriod(p: Period): RatioRow {
  const grossProfit = p.revenue !== null && p.cogs !== null ? p.revenue - p.cogs : null;
  const quickAssets = p.current_assets !== null && p.inventory !== null ? p.current_assets - p.inventory : null;

  const ratios: RatioRow = {
    period: p.period,
    "매출총이익률(%)": safeDiv(grossProfit, p.revenue),
    "영업이익률(%)": safeDiv(p.operating_income, p.revenue),
    "순이익률(%)": safeDiv(p.net_income, p.revenue),
    "ROA(%)": safeDiv(p.net_income, p.total_assets),
    "ROE(%)": safeDiv(p.net_income, p.total_equity),
    "유동비율(%)": safeDiv(p.current_assets, p.current_liabilities),
    "당좌비율(%)": safeDiv(quickAssets, p.current_liabilities),
    "현금비율(%)": safeDiv(p.cash, p.current_liabilities),
    "부채비율(%)": safeDiv(p.total_liabilities, p.total_equity),
    "부채자산비율(%)": safeDiv(p.total_liabilities, p.total_assets),
    "이자보상배율(x)": safeDiv(p.operating_income, p.interest_expense),
    "총자산회전율(x)": safeDiv(p.revenue, p.total_assets),
    "영업현금흐름대비순이익(x)": safeDiv(p.operating_cash_flow, p.net_income),
  };

  for (const key of Object.keys(ratios)) {
    if (PCT_KEYS.has(key) && typeof ratios[key] === "number") {
      ratios[key] = (ratios[key] as number) * 100;
    }
  }
  return ratios;
}

export function analyzeGrowth(periods: Period[]): GrowthRow[] {
  const rows: GrowthRow[] = [];
  for (let i = 0; i < periods.length - 1; i++) {
    const prev = periods[i];
    const curr = periods[i + 1];
    const row: GrowthRow = { period: `${prev.period} -> ${curr.period}` };
    const keys: (keyof Period)[] = ["revenue", "operating_income", "net_income", "total_assets", "total_equity"];
    for (const key of keys) {
      const prevV = prev[key] as number | null;
      const currV = curr[key] as number | null;
      if (prevV !== null && currV !== null && prevV !== 0) {
        row[`${key}_성장률(%)`] = ((currV - prevV) / Math.abs(prevV)) * 100;
      } else {
        row[`${key}_성장률(%)`] = null;
      }
    }
    rows.push(row);
  }
  return rows;
}
