import { getApiKey, getCorpCodeList, searchCompany, getCompanyPeriods, DartApiError, type Corp } from "./dartClient";
import { analyzePeriod, analyzeGrowth, type Period, type RatioRow, type GrowthRow } from "./ratios";

export interface CompanyData {
  inputName: string;
  corpName: string;
  corpCode: string;
  fsDiv: string | null;
  periods: Period[];
  ratioRows: RatioRow[];
  growthRows: GrowthRow[];
}

function resolveCompany(name: string, corpList: Corp[]): Corp {
  const matches = searchCompany(name, corpList);
  if (!matches.length) {
    throw new DartApiError(`'${name}' 회사를 찾을 수 없습니다.`);
  }
  return matches[0];
}

export async function compareCompanies(companyNames: string[], baseYear: number): Promise<CompanyData[]> {
  const apiKey = getApiKey();
  const corpList = await getCorpCodeList();

  const results: CompanyData[] = [];
  for (const name of companyNames) {
    const company = resolveCompany(name, corpList);
    const { periods, fsDiv } = await getCompanyPeriods(apiKey, company.corp_code, baseYear);
    const ratioRows = periods.map(analyzePeriod);
    const growthRows = analyzeGrowth(periods);
    results.push({
      inputName: name,
      corpName: company.corp_name,
      corpCode: company.corp_code,
      fsDiv,
      periods,
      ratioRows,
      growthRows,
    });
  }
  return results;
}
