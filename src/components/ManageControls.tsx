import type { ReactNode } from "react";
import {
  ExternalLink,
  Loader2,
  PackagePlus,
  Play,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { HeaderUptime } from "./HeaderUptime";
import { useT, type TFunc } from "../lib/i18n";

export interface ServiceView {
  status: string;
  started_at?: string;
  last_error?: string;
}

interface ManageControlsProps {
  service: ServiceView;
  busy: boolean;
  onStart: () => void;
  onRestart: () => void;
  onStop: () => void;
  onUninstall: () => void;
  onReinstall: () => void;
  onOpenUi: () => void;
}

function IconAction({
  title,
  onClick,
  disabled,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="relative group inline-flex">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 whitespace-nowrap rounded-md bg-slate-900 text-slate-50 text-[11px] font-medium px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg dark:bg-slate-700">
        {title}
      </span>
    </div>
  );
}

function statusLabel(status: string, t: TFunc) {
  switch (status) {
    case "running":
      return t("status.running");
    case "starting":
      return t("status.starting");
    case "restarting":
      return t("status.restarting");
    case "stopping":
      return t("status.stopping");
    case "error":
      return t("status.error");
    case "stopped":
      return t("status.stopped");
    default:
      return t("status.unknown");
  }
}

function statusDot(status: string) {
  switch (status) {
    case "running":
      return "bg-emerald-400 animate-pulse";
    case "starting":
    case "restarting":
      return "bg-amber-400 animate-pulse";
    case "stopping":
      return "bg-rose-400 animate-pulse";
    case "error":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

function statusPillClass(status: string) {
  switch (status) {
    case "running":
      return "border-emerald-400/30 bg-emerald-50 dark:bg-emerald-500/10";
    case "starting":
    case "restarting":
      return "border-amber-400/30 bg-amber-50 dark:bg-amber-500/10";
    case "stopping":
      return "border-rose-400/30 bg-rose-50 dark:bg-rose-500/10";
    case "error":
      return "border-rose-500/30 bg-rose-50 dark:bg-rose-500/10";
    default:
      return "border-slate-400/30 bg-white/70 dark:bg-slate-950/40";
  }
}

export function ManageControls({
  service,
  busy,
  onStart,
  onRestart,
  onStop,
  onUninstall,
  onReinstall,
  onOpenUi,
}: ManageControlsProps) {
  const t = useT();
  const running =
    service.status === "running" ||
    service.status === "starting" ||
    service.status === "restarting";
  const stopping = service.status === "stopping";

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/70 bg-white/95 backdrop-blur px-3 py-2.5">
      <button
        onClick={onOpenUi}
        title={t("controls.openUiTitle")}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[12.5px] font-bold transition flex-shrink-0"
      >
        <ExternalLink className="w-4 h-4" />
        {t("controls.openUi")}
      </button>

      <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

      <IconAction
        title={t("controls.start")}
        onClick={onStart}
        disabled={busy || running}
        className="border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300"
      >
        {service.status === "starting" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4 fill-current" />
        )}
      </IconAction>
      <IconAction
        title={t("controls.restart")}
        onClick={onRestart}
        disabled={busy}
        className="border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300"
      >
        <RotateCcw className={`w-4 h-4 ${service.status === "restarting" ? "animate-spin" : ""}`} />
      </IconAction>
      <IconAction
        title={t("controls.stop")}
        onClick={onStop}
        disabled={busy || stopping || service.status === "stopped" || service.status === "unknown"}
        className="border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300"
      >
        {service.status === "stopping" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Square className="w-4 h-4 fill-current" />
        )}
      </IconAction>

      <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

      <div className={`inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 border ${statusPillClass(service.status)}`}>
        <div className={`w-3 h-3 rounded-full ${statusDot(service.status)}`} />
        <div className="text-sm font-bold dark:text-slate-100 text-slate-900">
          {statusLabel(service.status, t)}
        </div>
        <HeaderUptime status={service.status} startedAt={service.started_at} />
      </div>

      <div className="flex-1 min-w-0" />

      <IconAction
        title={t("controls.reinstall")}
        onClick={onReinstall}
        disabled={busy || service.status === "starting" || service.status === "restarting" || service.status === "stopping"}
        className="border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300"
      >
        <PackagePlus className="w-4 h-4" />
      </IconAction>
      <IconAction
        title={t("controls.uninstall")}
        onClick={onUninstall}
        disabled={busy || service.status === "starting" || service.status === "restarting" || service.status === "stopping"}
        className="border border-rose-400/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-300"
      >
        <Trash2 className="w-4 h-4" />
      </IconAction>
    </div>
  );
}
