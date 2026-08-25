type GaugeTone = "emerald" | "amber" | "rose" | "slate";

function toneFor(pct: number, available: boolean): GaugeTone {
  if (!available) return "slate";
  if (pct >= 85) return "rose";
  if (pct >= 60) return "amber";
  return "emerald";
}

const TONE_STROKE: Record<GaugeTone, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#64748b",
};

export function CircularGauge({
  label,
  pct,
  sub,
  available = true,
  title,
}: {
  label: string;
  pct: number;
  sub?: string;
  available?: boolean;
  title?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;
  const tone = toneFor(clamped, available);
  const stroke = TONE_STROKE[tone];

  return (
    <div className="flex items-center gap-1.5 min-w-0" title={title}>
      <div className="flex flex-col justify-center min-w-0 leading-tight">
        <div className="text-[11px] font-semibold dark:text-slate-200 text-slate-700 whitespace-nowrap">{label}</div>
        {sub ? (
          <div className="text-[9.5px] dark:text-slate-500 text-slate-500 tabular-nums whitespace-nowrap">{sub}</div>
        ) : null}
      </div>
      <div className="relative w-[38px] h-[38px] shrink-0">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="7"
            className="stroke-slate-200 dark:stroke-slate-700/70"
          />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="7"
            stroke={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold tabular-nums dark:text-white text-slate-900">
            {available ? `${clamped}%` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
