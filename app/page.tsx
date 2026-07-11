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
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Corp[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyData[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

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
    setLoading(true);
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
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (selected.length < 2) {
      setError("비교할 회사를 2개 이상 선택해주세요.");
      return;
    }
    setError(null);
    setLoading(true);
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
      setLoading(false);
    }
  }

  const years = result ? result[0].periods.map((p) => p.period) : [];
  const growthPeriods = result ? result[0].growthRows.map((g) => g.period as string) : [];

  return (
    <main className="max-w-5xl mx-auto p-6 sm:p-10 w-full">
      <h1 className="text-2xl font-bold mb-1">DART 재무비교 대시보드</h1>
      <p className="text-sm text-gray-500 mb-6">
        회사명을 검색해 추가하고, 여러 회사의 최근 3개년 재무제표를 비교해보세요.
      </p>

      <div className="relative mb-4">
        <label className="block text-sm font-medium mb-1">회사명 검색</label>
        <input
          className="w-full border rounded-md px-3 py-2"
          placeholder="예: 삼성전자"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow max-h-60 overflow-auto">
            {suggestions.map((c) => (
              <li
                key={c.corp_code}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between text-black"
                onClick={() => addCompany(c.corp_name)}
              >
                <span>{c.corp_name}</span>
                <span className="text-xs text-gray-400">{c.stock_code || "비상장"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm"
            >
              {name}
              <button onClick={() => removeCompany(name)} className="text-blue-500 hover:text-blue-800">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">기준 연도</label>
          <input
            type="number"
            className="border rounded-md px-3 py-2 w-32"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <p className="text-xs text-gray-400 mt-1">이전 2개년 데이터도 함께 조회됩니다</p>
        </div>
        <button
          onClick={handleCompare}
          disabled={loading}
          className="bg-gray-900 text-white px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? "조회 중..." : "비교하기"}
        </button>
        <button
          onClick={handleDownload}
          disabled={loading}
          className="bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
        >
          엑셀 다운로드
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {result && (
        <div className="space-y-8">
          <div className="overflow-x-auto">
            <h2 className="font-semibold mb-2">재무비율 비교</h2>
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 bg-gray-100 text-left">지표</th>
                  {result.map((cd) =>
                    years.map((y) => (
                      <th key={`${cd.corpName}-${y}`} className="border px-2 py-1 bg-gray-100 text-center">
                        {cd.corpName}
                        <br />
                        {y}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {RATIO_LABELS.map((label) => (
                  <tr key={label}>
                    <td className="border px-2 py-1 font-medium">{label}</td>
                    {result.map((cd) =>
                      cd.ratioRows.map((rr, i) => (
                        <td key={`${cd.corpName}-${i}`} className="border px-2 py-1 text-right">
                          {formatValue(rr[label])}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <h2 className="font-semibold mb-2">성장성 비교 (YoY, %)</h2>
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 bg-gray-100 text-left">지표</th>
                  {result.map((cd) =>
                    growthPeriods.map((gp) => (
                      <th key={`${cd.corpName}-${gp}`} className="border px-2 py-1 bg-gray-100 text-center">
                        {cd.corpName}
                        <br />
                        {gp}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {GROWTH_LABELS.map((label) => (
                  <tr key={label}>
                    <td className="border px-2 py-1 font-medium">{label}</td>
                    {result.map((cd) =>
                      cd.growthRows.map((gr, i) => (
                        <td key={`${cd.corpName}-g-${i}`} className="border px-2 py-1 text-right">
                          {formatValue(gr[label])}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
