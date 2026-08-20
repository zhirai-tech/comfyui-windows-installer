import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { DockerIcon, GpuHostIcon } from "./BrandIcons";
import { useT } from "../lib/i18n";

export function ModeCard({
  mode,
  active,
  onClick,
}: {
  mode: "host" | "docker";
  active: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const host = mode === "host";
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border transition-all p-3 h-full flex flex-col items-start justify-start ${
        active
          ? host
            ? "border-brand-500 dark:bg-brand-500/5 bg-brand-50 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]"
            : "border-violet-500 dark:bg-violet-500/5 bg-violet-50 shadow-[0_0_0_1px_rgba(139,92,246,0.3)]"
          : "dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/80 dark:hover:border-slate-600 hover:border-slate-400"
      }`}
    >
      <div className="flex items-center justify-between mb-2 w-full">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center">
            {host ? (
              <GpuHostIcon className="w-11 h-11 drop-shadow-[0_2px_0_rgba(0,0,0,0.45)]" />
            ) : (
              <DockerIcon className="w-11 h-11 drop-shadow-[0_2px_0_rgba(0,0,0,0.45)]" />
            )}
          </div>
          <div>
            <div className="font-bold text-[14px] dark:text-slate-100 text-slate-900">
              {host ? t("mode.host") : t("mode.docker")}
            </div>
            <div className="text-[11px] dark:text-slate-400 text-slate-600 font-medium">
              {host ? t("mode.hostSub") : t("mode.dockerSub")}
            </div>
          </div>
        </div>
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            active
              ? host
                ? "border-brand-400 bg-brand-500"
                : "border-violet-400 bg-violet-500"
              : "dark:border-slate-600 border-slate-400"
          }`}
        >
          {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>

      <div className="space-y-1 border-t dark:border-slate-800 border-slate-200 pt-2 text-[11px] w-full leading-snug">
        <div className="flex items-start gap-1.5 dark:text-emerald-300/90 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="min-w-0">
            {host ? t("mode.hostPro") : t("mode.dockerPro")}
          </span>
        </div>
        <div className="flex items-start gap-1.5 dark:text-amber-300/90 text-amber-700 font-medium">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="min-w-0">
            {host ? t("mode.hostCon") : t("mode.dockerCon")}
          </span>
        </div>
        <div className="flex items-start gap-1.5 dark:text-rose-300/90 text-rose-700 font-medium">
          <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="min-w-0">
            {host ? t("mode.hostNot") : t("mode.dockerNot")}
          </span>
        </div>

        {host && (
          <div className="mt-1.5 rounded-lg border dark:border-sky-500/30 border-sky-400/40 dark:bg-sky-500/5 bg-sky-50 p-2 text-[10.5px] dark:text-sky-200 text-sky-800 leading-relaxed">
            <div className="font-bold mb-0.5">{t("mode.hostNoteTitle")}</div>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>{t("mode.hostNote1")}</li>
              <li>{t("mode.hostNote2")}</li>
              <li>{t("mode.hostNote3")}</li>
            </ol>
          </div>
        )}

        {!host && (
          <div className="mt-1.5 rounded-lg border dark:border-amber-500/30 border-amber-400/40 dark:bg-amber-500/5 bg-amber-50 p-2 text-[10.5px] dark:text-amber-200 text-amber-800 leading-relaxed">
            <div className="font-bold mb-0.5">{t("mode.dockerReqTitle")}</div>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>{t("mode.dockerReq1")}</li>
              <li>{t("mode.dockerReq2")}</li>
              <li>{t("mode.dockerReq3")}</li>
            </ol>
          </div>
        )}
      </div>
    </button>
  );
}
