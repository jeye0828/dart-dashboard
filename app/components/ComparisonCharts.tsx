"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Period {
  period: string;
  revenue: number | null;
}

interface CompanyData {
  corpName: string;
  periods: Period[];
  ratioRows: Record<string, string | number | null>[];
}

const COLORS = ["#3182F6", "#00C896", "#F59E0B", "#8B5CF6", "#F04452", "#0EA5E9"];

function toEok(v: number | null): number | null {
  if (v === null || v === undefined) return null;
  return Math.round((v / 100_000_000) * 10) / 10; // 원 -> 억 원
}

function tickFormatter(v: number) {
  return v.toLocaleString();
}

export default function ComparisonCharts({ companies }: { companies: CompanyData[] }) {
  const years = companies[0]?.periods.map((p) => p.period) ?? [];

  const revenueData = years.map((year, i) => {
    const row: Record<string, string | number | null> = { year };
    companies.forEach((cd) => {
      row[cd.corpName] = toEok(cd.periods[i]?.revenue ?? null);
    });
    return row;
  });

  const latestRatioData = (label: string) =>
    companies.map((cd) => ({
      name: cd.corpName,
      value: cd.ratioRows[cd.ratioRows.length - 1]?.[label] ?? null,
    }));

  const barMetrics: { label: string; title: string }[] = [
    { label: "영업이익률(%)", title: "영업이익률 (최근년도, %)" },
    { label: "ROE(%)", title: "ROE (최근년도, %)" },
    { label: "부채비율(%)", title: "부채비율 (최근년도, %)" },
  ];

  return (
    <section className="bg-surface rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-foreground mb-4">한눈에 보기</h2>

      <div className="mb-6">
        <p className="text-sm font-semibold text-muted mb-2">매출액 추이 (억 원)</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EB" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#8B95A1" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: "#8B95A1" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E5E8EB", fontSize: 13 }}
                formatter={(v) => [`${Number(v).toLocaleString()}억 원`, ""]}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              {companies.map((cd, i) => (
                <Line
                  key={cd.corpName}
                  type="monotone"
                  dataKey={cd.corpName}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        {barMetrics.map(({ label, title }) => (
          <div key={label}>
            <p className="text-sm font-semibold text-muted mb-2">{title}</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latestRatioData(label)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EB" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#8B95A1" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#8B95A1" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E8EB", fontSize: 13 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {companies.map((cd, i) => (
                      <Cell key={cd.corpName} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
