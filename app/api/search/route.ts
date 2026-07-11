import { NextRequest, NextResponse } from "next/server";
import { getApiKey, getCorpCodeList, searchCompany, DartApiError } from "@/lib/dartClient";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  try {
    const apiKey = getApiKey();
    const corpList = await getCorpCodeList(apiKey);
    const results = searchCompany(q, corpList).slice(0, 20);
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof DartApiError ? e.message : "회사 검색 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
