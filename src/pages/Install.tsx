import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect } from "react";
import InstallProgress from "../components/InstallProgress";
import LogViewer from "../components/LogViewer";
import { useInstallerStore } from "../store/installerStore";
import { DockerIcon, GpuHostIcon } from "../components/BrandIcons";
import { useInstallFlow } from "../hooks/useInstallFlow";
import { useT } from "../lib/i18n";

export default function Install() {
  const t = useT();
  const go = useInstallerStore((s) => s.go);
  const running = useInstallerStore((s) => s.running);
  const error = useInstallerStore((s) => s.error);
  const installMode = useInstallerStore((s) => s.installMode);

  const { runAll, started, doneBanner } = useInstallFlow();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => go(installMode === "docker" ? "welcome" : "detect")}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm
              dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white
              border-slate-400 hover:border-slate-600 text-slate-800 hover:text-slate-900 bg-white/50 hover:bg-white
              transition disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" /> {t("common.back")}
          </button>
          {installMode === "docker" ? (
            <DockerIcon className="w-9 h-9 drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]" />
          ) : (
            <GpuHostIcon className="w-9 h-9 drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]" />
          )}
          <div className="text-[15px] font-bold dark:text-slate-100 text-slate-900">
            {installMode === "docker" ? t("mode.docker") : t("mode.host")}
          </div>
        </div>
        <h2 className="text-lg font-semibold dark:text-slate-100 text-slate-900">{t("install.installing")}</h2>
      </div>

      {doneBanner && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow transition-all duration-200 flex-shrink-0 ${
            doneBanner === "done"
              ? "border-emerald-500/50 dark:border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/5"
              : doneBanner === "starting"
              ? "border-amber-500/50 dark:border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/5"
              : "border-emerald-500/50 dark:border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/5"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {doneBanner === "done" ? (
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
              </div>
            ) : (
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                  doneBanner === "starting"
                    ? "bg-amber-500/15 dark:bg-amber-500/10 border-amber-500/30"
                    : "bg-emerald-500/15 dark:bg-emerald-500/10 border-emerald-500/30"
                }`}
              >
                <Loader2
                  className={`w-5 h-5 animate-spin ${
                    doneBanner === "starting"
                      ? "text-amber-600 dark:text-amber-300"
                      : "text-emerald-600 dark:text-emerald-300"
                  }`}
                />
              </div>
            )}
            <div className="min-w-0">
              <div
                className={`text-sm font-bold ${
                  doneBanner === "done"
                    ? "text-emerald-700 dark:text-emerald-200"
                    : doneBanner === "starting"
                    ? "text-amber-700 dark:text-amber-200"
                    : "text-emerald-700 dark:text-emerald-200"
                }`}
              >
                {doneBanner === "done"
                  ? t("install.done")
                  : doneBanner === "starting"
                  ? t("install.starting")
                  : t("install.running")}
              </div>
              <div className="text-[11px] dark:text-slate-400 text-slate-600 font-medium mt-0.5">
                {doneBanner === "done"
                  ? t("install.doneSub")
                  : doneBanner === "starting"
                  ? t("install.startingSub")
                  : t("install.runningSub")}
              </div>
            </div>
          </div>
          <button
            onClick={() => go("manage")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow shadow-emerald-500/20 transition flex-shrink-0"
          >
            {t("install.enter")}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border
          border-red-500/40 dark:border-red-500/30
          bg-red-50 dark:bg-red-500/10
          p-3.5 text-sm
          space-y-2 flex-shrink-0 shadow-sm">
          <div className="font-semibold dark:text-red-100 text-red-800">{t("install.failed")}</div>
          <div className="whitespace-pre-wrap break-words dark:text-red-200 text-red-700 font-medium leading-relaxed">{error}</div>
          {installMode === "docker" && (
            <div className="text-xs
              dark:text-red-200/90 dark:bg-red-500/10 dark:border-red-500/20
              text-red-700 bg-red-100/70 border border-red-500/30
              rounded-lg p-2.5 leading-relaxed">
              {t("install.commonReasons")}
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>{t("install.reason1")}</li>
                <li>{t("install.reason2")}</li>
                <li>{t("install.reason3")}</li>
              </ul>
            </div>
          )}
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={() => {
                started.current = false;
                void runAll();
              }}
              className="px-3 py-1.5 rounded-lg
                bg-red-500 hover:bg-red-600 text-white
                dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-50
                text-xs font-semibold shadow-sm shadow-red-500/15 transition"
            >
              {t("install.retry")}
            </button>
            <button
              onClick={() => go("settings")}
              className="px-3 py-1.5 rounded-lg border
                border-red-500/50 hover:bg-red-500/10 text-xs font-medium
                dark:border-red-500/30 dark:hover:bg-red-500/10 dark:text-red-100
                text-red-700 hover:text-red-800"
            >
              {t("install.advanced")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-10 gap-4 flex-1 min-h-0 items-stretch">
        <div className="md:col-span-4 min-h-0 h-full">
          <InstallProgress />
        </div>
        <div className="md:col-span-6 min-h-0 h-full">
          <LogViewer sideBySide />
        </div>
      </div>
    </div>
  );
}
