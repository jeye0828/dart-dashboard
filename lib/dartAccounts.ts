// DART는 업종/보고서마다 계정과목명이 조금씩 다르게 표기되므로 후보를 여러 개 둔다.
export const ACCOUNT_MAP: Record<string, { sjDivs: string[]; candidates: string[] }> = {
  revenue: { sjDivs: ["IS", "CIS"], candidates: ["매출액", "수익(매출액)", "영업수익", "매출"] },
  cogs: { sjDivs: ["IS", "CIS"], candidates: ["매출원가"] },
  operating_income: { sjDivs: ["IS", "CIS"], candidates: ["영업이익", "영업이익(손실)"] },
  net_income: {
    sjDivs: ["IS", "CIS"],
    candidates: ["당기순이익(손실)", "당기순이익", "반기순이익(손실)", "분기순이익(손실)"],
  },
  interest_expense: { sjDivs: ["IS", "CIS"], candidates: ["이자비용", "금융비용"] },
  total_assets: { sjDivs: ["BS"], candidates: ["자산총계"] },
  current_assets: { sjDivs: ["BS"], candidates: ["유동자산"] },
  inventory: { sjDivs: ["BS"], candidates: ["재고자산"] },
  cash: { sjDivs: ["BS"], candidates: ["현금및현금성자산"] },
  total_liabilities: { sjDivs: ["BS"], candidates: ["부채총계"] },
  current_liabilities: { sjDivs: ["BS"], candidates: ["유동부채"] },
  total_equity: { sjDivs: ["BS"], candidates: ["자본총계"] },
  operating_cash_flow: { sjDivs: ["CF"], candidates: ["영업활동현금흐름", "영업활동으로인한현금흐름"] },
};
