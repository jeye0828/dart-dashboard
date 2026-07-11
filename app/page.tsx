"use client";

import { useEffect, useRef, useState } from "react";
import { RATIO_LABELS, GROWTH_LABELS } from "@/lib/ratios";

interface Corp {
  corp_code: string;
  corp_name: string;
  stock_code: string;
}

interface CompanyData {
  inputName: string;
  corpName: string;
  fsDiv: string | null;
  periods: { period: string }[];
  ratioRows: Record<string, string | number | null>[];
  growthRows: Record<string, string | number | null>[];
}

function formatValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v;
}

function valueColor(v: string | number | null | undefined): string {
  if (typeof v === "number" && v < 0) return "text-negative";
  return "text-foreground";
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Corp[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [compareLoading, setCompareLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyData[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addCompany(name: string) {
    if (!selected.includes(name)) {
      setSelected([...selected, name]);
    }
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function removeCompany(name: string) {
    setSelected(selected.filter((s) => s !== name));
  }

  async function handleCompare() {
    setError(null);
    setResult(null);
    if (selected.length < 2) {
      setError("비교할 회사를 2개 이상 선택해주세요.");
      return;
    }
    setCompareLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: selected, year }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "조회 중 오류가 발생했습니다.");
      } else {
        setResult(data.companies);
      }
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.");
    } finally {
      setCompareLoading(false);
    }
  }

  async function handleDownload() {
    if (selected.length < 2) {
      setError("비교할 회사를 2개 이상 선택해주세요.");
      return;
    }
    setError(null);
    setDownloadLoading(true);
    try {
      const res = await fetch("/api/compare/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: selected, year }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "엑셀 생성 중 오류가 발생했습니다.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparison_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("엑셀 다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloadLoading(false);
    }
  }

  const years = result ? result[0].periods.map((p) => p.period) : [];
  const growthPeriods = result ? result[0].growthRows.map((g) => g.period as string) : [];
  const busy = compareLoading || downloadLoading;

  return (
    <main className="min-h-screen w-full">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-sm">
              D
            </div>
            <span className="text-sm font-semibold text-muted">DART 재무비교</span>
          </div>
          <h1 className="text-[28px] sm:text-3xl font-extrabold tracking-tight text-foreground leading-snug">
            궁금한 회사, 숫자로
            <br />
            비교해보세요
          </h1>
          <p className="text-[15px] text-muted mt-2">
            회사명을 검색해 추가하고, 최근 3개년 재무제표를 한눈에 비교해요.
          </p>
        </div>

        <section className="bg-surface rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-5 sm:p-6 mb-5">
          <div ref={searchBoxRef} className="relative">
            <label className="block text-[13px] font-semibold text-muted mb-2">회사명 검색</label>
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="w-full bg-background rounded-xl pl-11 pr-4 py-3.5 text-[15px] font-medium text-foreground placeholder:text-muted/70 outline-none ring-2 ring-transparent focus:ring-brand transition-shadow"
                placeholder="예: 삼성전자"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
              />
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-2 w-full bg-surface rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border max-h-72 overflow-auto py-2">
                {suggestions.map((c) => (
                  <li
                    key={c.corp_code}
                    className="mx-2 px-3.5 py-2.5 rounded-xl hover:bg-brand-soft cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => addCompany(c.corp_name)}
                  >
                    <span className="font-semibold text-[15px] text-foreground">{c.corp_name}</span>
                    <span className="text-xs font-medium text-muted bg-background px-2 py-1 rounded-full">
                      {c.stock_code || "비상장"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {selected.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 bg-brand-soft text-brand-dark font-semibold text-sm pl-4 pr-2.5 py-2 rounded-full"
                >
                  {name}
                  <button
                    onClick={() => removeCompany(name)}
                    aria-label={`${name} 제거`}
                    className="w-[18px] h-[18px] flex items-center justify-center rounded-full text-brand-dark/70 hover:bg-brand hover:text-white transition-colors text-base leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="h-px bg-border my-5" />

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-muted mb-2">기준 연도</label>
              <input
                type="number"
                className="bg-background rounded-xl px-4 py-3 text-[15px] font-semibold w-28 outline-none ring-2 ring-transparent focus:ring-brand transition-shadow"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <button
              onClick={handleCompare}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-brand text-white font-bold px-5 py-3 rounded-xl shadow-sm hover:bg-brand-dark active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all"
            >
              {compareLoading && <Spinner />}
              비교하기
            </button>
            <button
              onClick={handleDownload}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-background text-foreground font-bold px-5 py-3 rounded-xl border border-border hover:bg-gray-100 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all"
            >
              {downloadLoading && <Spinner />}
              엑셀 다운로드
            </button>
          </div>
          <p className="text-xs text-muted mt-2.5">이전 2개년 데이터도 함께 조회돼요</p>
        </section>

        {error && (
          <div className="bg-red-50 text-negative font-semibold text-sm rounded-2xl px-5 py-4 mb-5">{error}</div>
        )}

        {result && (
          <div className="space-y-5">
            <section className="bg-surface rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-5 sm:p-6 overflow-hidden">
              <h2 className="text-lg font-extrabold text-foreground mb-4">재무비율 비교</h2>
              <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-surface text-left text-xs font-semibold text-muted uppercase tracking-wide pb-3 pr-4 border-b border-border">
                        지표
                      </th>
                      {result.map((cd) =>
                        years.map((y) => (
                          <th
                            key={`${cd.corpName}-${y}`}
                            className="text-center text-xs font-semibold text-muted pb-3 px-3 border-b border-border whitespace-nowrap"
                          >
                            <div className="text-foreground font-bold">{cd.corpName}</div>
                            {y}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {RATIO_LABELS.map((label) => (
                      <tr key={label} className="group">
                        <td className="sticky left-0 bg-surface group-hover:bg-gray-50 font-semibold text-foreground py-3 pr-4 border-b border-border whitespace-nowrap">
                          {label}
                        </td>
                        {result.map((cd) =>
                          cd.ratioRows.map((rr, i) => (
                            <td
                              key={`${cd.corpName}-${i}`}
                              className={`text-right py-3 px-3 border-b border-border tabular-nums group-hover:bg-gray-50 ${valueColor(
                                rr[label]
                              )}`}
                            >
                              {formatValue(rr[label])}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-surface rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-5 sm:p-6 overflow-hidden">
              <h2 className="text-lg font-extrabold text-foreground mb-4">성장성 비교 (YoY, %)</h2>
              <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-surface text-left text-xs font-semibold text-muted uppercase tracking-wide pb-3 pr-4 border-b border-border">
                        지표
                      </th>
                      {result.map((cd) =>
                        growthPeriods.map((gp) => (
                          <th
                            key={`${cd.corpName}-${gp}`}
                            className="text-center text-xs font-semibold text-muted pb-3 px-3 border-b border-border whitespace-nowrap"
                          >
                            <div className="text-foreground font-bold">{cd.corpName}</div>
                            {gp}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {GROWTH_LABELS.map((label) => (
                      <tr key={label} className="group">
                        <td className="sticky left-0 bg-surface group-hover:bg-gray-50 font-semibold text-foreground py-3 pr-4 border-b border-border whitespace-nowrap">
                          {label}
                        </td>
                        {result.map((cd) =>
                          cd.growthRows.map((gr, i) => (
                            <td
                              key={`${cd.corpName}-g-${i}`}
                              className={`text-right py-3 px-3 border-b border-border tabular-nums group-hover:bg-gray-50 ${valueColor(
                                gr[label]
                              )}`}
                            >
                              {formatValue(gr[label])}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
