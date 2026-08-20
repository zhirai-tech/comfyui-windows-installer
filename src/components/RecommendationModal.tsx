import { useState } from "react";
import { BarChart3, Loader2, X } from "lucide-react";
import { useT } from "../lib/i18n";

type RecTier = "entry" | "mid" | "high" | "flagship";

function getTier(vram: number): RecTier {
  if (!vram || vram < 6) return "entry";
  if (vram < 12) return "mid";
  if (vram < 20) return "high";
  return "flagship";
}

const TIER_CLS: Record<RecTier, string> = {
  entry: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  mid: "bg-brand-500/10 text-brand-700 dark:text-brand-200 border-brand-500/30",
  high: "bg-violet-500/10 text-violet-700 dark:text-violet-200 border-violet-500/30",
  flagship: "bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/30",
};

/* 后期有服务器后：把 summary 换成 fetch('/api/ai/rec?gpu=...&vram=24')，
 * 返回 1 段简洁字符串即可，不用改 UI */

export function RecommendationModal({
  vram,
  onClose,
}: {
  vram: number;
  onClose: () => void;
}) {
  const t = useT();
  const tier = getTier(vram);
  const [loading, setLoading] = useState(false);
  const summary = t(`rec.summary.${tier}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/55 dark:bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-slate-800 border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base font-bold dark:text-slate-100 text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4.5 h-4.5 text-brand-500 dark:text-brand-300" />
              {t("rec.title")}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${TIER_CLS[tier]}`}
            >
              {t(`rec.badge.${tier}`)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-500/10 transition dark:text-slate-400 text-slate-600"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="px-5 py-5">
          <div className="text-[11px] uppercase tracking-wider dark:text-slate-500 text-slate-600 font-semibold mb-2.5">
            {t("rec.section")}
          </div>
          {loading ? (
            <div className="inline-flex items-center gap-2 text-[12.5px] dark:text-slate-400 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              {t("rec.loading")}
            </div>
          ) : (
            <p className="text-[13px] leading-[1.75] dark:text-slate-300 text-slate-800">
              {summary}
            </p>
          )}
        </div>
        <div className="px-5 py-3.5 border-t dark:border-slate-800 border-slate-200 flex items-center justify-between gap-3 bg-slate-500/5">
          <div className="text-[10.5px] dark:text-slate-500 text-slate-600">
            {t("rec.footer")}
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-[12.5px] font-bold shadow transition"
          >
            {t("rec.gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}
