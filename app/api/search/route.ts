import { NextRequest, NextResponse } from "next/server";
import { getCorpCodeList, searchCompany } from "@/lib/dartClient";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  const corpList = await getCorpCodeList();
  const results = searchCompany(q, corpList).slice(0, 20);
  return NextResponse.json({ results });
}
