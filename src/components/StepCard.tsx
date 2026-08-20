import { Check, Loader2, X, Circle } from "lucide-react";
import type { StepState } from "../store/installerStore";
import { useT } from "../lib/i18n";

interface Props {
  step: StepState;
}

export default function StepCard({ step }: Props) {
  const t = useT();
  const Icon =
    step.status === "success"
      ? Check
      : step.status === "error"
      ? X
      : step.status === "running"
      ? Loader2
      : Circle;

  const color =
    step.status === "success"
      ? "text-emerald-500 dark:text-emerald-400"
      : step.status === "error"
      ? "text-red-500 dark:text-red-400"
      : step.status === "running"
      ? "text-brand-500 animate-spin"
      : "text-slate-400 dark:text-slate-500";

  const titleColor =
    step.status === "success"
      ? "text-emerald-700 dark:text-emerald-200"
      : step.status === "error"
      ? "text-red-700 dark:text-red-200"
      : step.status === "running"
      ? "text-slate-900 dark:text-white"
      : "text-slate-600 dark:text-slate-300";

  const labelKey = `step.${step.key}`;
  const label = t(labelKey);
  const displayLabel = label === labelKey ? step.label : label;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`flex-shrink-0 ${color}`}>
        <Icon className={`w-5 h-5 ${step.status === "running" ? "animate-spin" : ""}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${titleColor}`}>{displayLabel}</div>
        {step.status !== "pending" && (
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                step.status === "error"
                  ? "bg-red-500"
                  : step.status === "success"
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-brand-500 to-indigo-500"
              }`}
              style={{ width: `${step.progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
