import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useT } from "../lib/i18n";

export type DetectPhase = "idle" | "system" | "gpu" | "env" | "deps" | "done";

const PHASE_ORDER: DetectPhase[] = ["idle", "system", "gpu", "env", "deps", "done"];

export function phaseAtLeast(current: DetectPhase, target: DetectPhase): boolean {
  return PHASE_ORDER.indexOf(current) >= PHASE_ORDER.indexOf(target);
}

export interface SystemInfoLite {
  cpu_name: string;
  cpu_cores: number;
  ram_total_gb: number;
  ram_available_gb?: number;
  os_name: string;
  os_version: string;
  os_arch: string;
  hostname?: string;
}

export interface PythonInfoLite {
  found: boolean;
  version: string;
  executable: string;
  is_compatible: boolean | null;
  pip_ok?: boolean | null;
  git_ok?: boolean | null;
  node_ok?: boolean | null;
  virtualenv_ok?: boolean | null;
  visual_cpp_ok?: boolean | null;
}

export function Row({
  icon,
  label,
  value,
  state,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  state?: "pending" | "loading" | "ok" | "bad";
}) {
  const valueColor =
    state === "ok"
      ? "dark:text-slate-200 text-slate-900"
      : state === "bad"
      ? "dark:text-rose-300 text-rose-700"
      : state === "loading"
      ? "dark:text-slate-400 text-slate-700"
      : "dark:text-slate-500 text-slate-600";
  return (
    <div className="py-1.5 flex items-start gap-2.5">
      <div
        className={`mt-0.5 flex-shrink-0 transition-all duration-200 ${
          state === "ok"
            ? "dark:text-slate-400 text-slate-800"
            : state === "bad"
            ? "dark:text-rose-300/90 text-rose-700"
            : "dark:text-slate-500 text-slate-600"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-wider dark:text-slate-500 text-slate-700 font-semibold">
            {label}
          </div>
          <StateDot state={state} />
        </div>
        <div
          className={`mt-1 text-sm font-semibold truncate transition-all duration-200 ${valueColor} ${
            state === "loading" ? "animate-pulse" : ""
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export function StateDot({ state }: { state?: "pending" | "loading" | "ok" | "bad" }) {
  const t = useT();
  if (state === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold dark:text-amber-300 text-amber-800">
        <Loader2 className="w-3 h-3 animate-spin" /> {t("hw.detecting")}
      </span>
    );
  }
  if (state === "ok") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-slate-800/15 dark:bg-slate-500/10 text-slate-900 dark:text-slate-300 text-[10px] font-bold w-5 h-5 border border-slate-700/30 dark:border-slate-500/20">
        ✓
      </span>
    );
  }
  if (state === "bad") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-bold w-5 h-5 border border-rose-600/40 dark:border-rose-500/30">
        ✗
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-slate-600/15 text-slate-700 dark:text-slate-400 text-[10px] font-bold w-5 h-5 border border-slate-600/35 dark:border-slate-500/30">
      ·
    </span>
  );
}

export function DepChip({
  state,
  icon,
  label,
  transitionDelay = "0ms",
}: {
  state?: null | boolean | "pending" | "loading" | "ok" | "bad";
  icon: React.ReactNode;
  label: string;
  transitionDelay?: string;
}) {
  const ok = state === true || state === "ok";
  const bad = state === false || state === "bad";
  const loading = state === "loading";
  const pending = state === null || state === undefined || state === "pending";
  return (
    <div
      style={{ transitionDelay }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all duration-200 ${
        ok
          ? "bg-slate-900/10 text-slate-900 dark:text-slate-200 border-slate-700/40 dark:border-slate-500/25"
          : bad
          ? "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-700/40 dark:border-rose-500/30"
          : loading
          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-700/40 dark:border-amber-500/30"
          : "bg-slate-700/10 text-slate-800 dark:text-slate-400 border-slate-700/40 dark:border-slate-500/30"
      }`}
    >
      <span className="inline-flex items-center justify-center">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      </span>
      {label}
      <span className="ml-auto w-4 h-4 inline-flex items-center justify-center rounded-full border border-current/30">
        {ok ? "✓" : bad ? "✗" : pending ? "·" : "…"}
      </span>
    </div>
  );
}

export function VersionBadge({
  ok,
  label,
}: {
  ok: boolean | null;
  label: string;
}) {
  const state =
    ok === true ? "ok" : ok === false ? "bad" : ok === null ? "loading" : "pending";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border transition-all duration-200 ${
        state === "ok"
          ? "bg-slate-900/10 dark:bg-slate-500/10 text-slate-900 dark:text-slate-200 border-slate-700/40 dark:border-slate-500/30"
          : state === "bad"
          ? "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-700/40 dark:border-rose-500/40"
          : state === "loading"
          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-700/40 dark:border-amber-500/40 animate-pulse"
          : "bg-slate-700/10 text-slate-800 dark:text-slate-400 border-slate-700/40 dark:border-slate-500/30"
      }`}
    >
      {state === "loading" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : state === "ok" ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : state === "bad" ? (
        <XCircle className="w-3 h-3" />
      ) : null}
      {label}
    </div>
  );
}
