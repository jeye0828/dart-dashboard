import { NextRequest, NextResponse } from "next/server";
import { compareCompanies } from "@/lib/compareService";
import { DartApiError } from "@/lib/dartClient";

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

  try {
    const results = await compareCompanies(companies, Number(year));
    return NextResponse.json({ companies: results });
  } catch (e) {
    const message = e instanceof DartApiError ? e.message : "비교 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
