import StepCard from "./StepCard";
import { useInstallerStore } from "../store/installerStore";
import { useT } from "../lib/i18n";

export default function InstallProgress() {
  const t = useT();
  const steps = useInstallerStore((s) => s.steps);
  const overallPercent = useInstallerStore((s) => s.overallPercent);
  const running = useInstallerStore((s) => s.running);
  const error = useInstallerStore((s) => s.error);

  return (
    <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-5 backdrop-blur h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="text-base font-semibold dark:text-slate-100 text-slate-900">
          {t("install.progressTitle")}
        </div>
        <div className="text-sm dark:text-slate-400 text-slate-600 tabular-nums">
          {t("install.progressTotal")}
          <span className="dark:text-white text-slate-900 font-medium">
            {overallPercent}%
          </span>
        </div>
      </div>

      <div className="h-2 w-full rounded-full dark:bg-slate-800 bg-slate-200 overflow-hidden mb-5 flex-shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            error
              ? "bg-gradient-to-r from-red-500 to-rose-500"
              : running
              ? "bg-gradient-to-r from-brand-500 to-indigo-500 animate-pulse-slow"
              : "bg-gradient-to-r from-emerald-500 to-teal-500"
          }`}
          style={{ width: `${overallPercent}%` }}
        />
      </div>

      <div className="space-y-0.5 divide-y dark:divide-slate-800/60 divide-slate-200 flex-1 min-h-0 overflow-y-auto pr-1">
        {steps.map((s) => (
          <StepCard key={s.key} step={s} />
        ))}
      </div>
    </div>
  );
}
