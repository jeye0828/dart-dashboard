import { RAW_FIELDS, RATIO_LABELS, type Period } from "@/lib/ratios";

interface CompanyData {
  corpName: string;
  fsDiv: string | null;
  periods: Period[];
  ratioRows: Record<string, string | number | null>[];
}

function formatRaw(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  return Math.round(v).toLocaleString();
}

function formatRatio(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v;
}

function valueColor(v: string | number | null | undefined): string {
  if (typeof v === "number" && v < 0) return "text-negative";
  return "text-foreground";
}

export default function CompanyStatement({ company }: { company: CompanyData }) {
  return (
    <section className="bg-surface rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-extrabold text-foreground">{company.corpName}</h2>
        <span className="text-xs font-semibold text-muted bg-background px-2.5 py-1 rounded-full">
          {company.fsDiv === "CFS" ? "연결재무제표" : "개별재무제표"}
        </span>
      </div>

      <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
        <table className="min-w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface text-left text-xs font-semibold text-muted uppercase tracking-wide pb-3 pr-4 border-b border-border">
                계정
              </th>
              {company.periods.map((p) => (
                <th
                  key={p.period}
                  className="text-right text-xs font-semibold text-muted pb-3 pl-4 border-b border-border whitespace-nowrap"
                >
                  {p.period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RAW_FIELDS.map(([label, key]) => (
              <tr key={label} className="group">
                <td className="sticky left-0 bg-surface group-hover:bg-gray-50 font-semibold text-foreground py-3 pr-4 border-b border-border whitespace-nowrap">
                  {label}
                </td>
                {company.periods.map((p) => (
                  <td
                    key={p.period}
                    className="text-right py-3 pl-4 border-b border-border tabular-nums text-foreground group-hover:bg-gray-50"
                  >
                    {formatRaw(p[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-extrabold text-foreground mt-6 mb-3">재무비율</h3>
      <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
        <table className="min-w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface text-left text-xs font-semibold text-muted uppercase tracking-wide pb-3 pr-4 border-b border-border">
                지표
              </th>
              {company.periods.map((p) => (
                <th
                  key={p.period}
                  className="text-right text-xs font-semibold text-muted pb-3 pl-4 border-b border-border whitespace-nowrap"
                >
                  {p.period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RATIO_LABELS.map((label) => (
              <tr key={label} className="group">
                <td className="sticky left-0 bg-surface group-hover:bg-gray-50 font-semibold text-foreground py-3 pr-4 border-b border-border whitespace-nowrap">
                  {label}
                </td>
                {company.ratioRows.map((rr, i) => (
                  <td
                    key={i}
                    className={`text-right py-3 pl-4 border-b border-border tabular-nums group-hover:bg-gray-50 ${valueColor(
                      rr[label]
                    )}`}
                  >
                    {formatRatio(rr[label])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
