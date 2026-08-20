import { ArrowRight, MonitorPlay, RefreshCw } from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { ModeCard } from "../components/ModeCard";
import { useWelcomeBootstrap } from "../hooks/useWelcomeBootstrap";
import { useT } from "../lib/i18n";

export default function Welcome() {
  const t = useT();
  const go = useInstallerStore((s) => s.go);
  const installMode = useInstallerStore((s) => s.installMode);
  const setInstallMode = useInstallerStore((s) => s.setInstallMode);
  const setInstallDir = useInstallerStore((s) => s.setInstallDir);
  const installDir = useInstallerStore((s) => s.installDir);
  const installDirError = useInstallerStore((s) => s.installDirError);
  const setInstallDirError = useInstallerStore((s) => s.setInstallDirError);
  const service = useInstallerStore((s) => s.service);

  const { loading, hasExisting, applyVersionConfig } = useWelcomeBootstrap();

  const validate = async (v: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("validate_install_dir", { path: v });
      setInstallDirError(null);
    } catch (e: any) {
      setInstallDirError(e ?? t("welcome.dirInvalid"));
    }
  };

  const continueNext = () => {
    applyVersionConfig("latest", "master");
    if (hasExisting && installMode === "host") {
      go("manage");
    } else {
      go("detect");
    }
  };

  return (
    <div className="space-y-4 min-h-0 h-full flex flex-col">
      <div className="flex-shrink-0">
        <h1 className="text-lg font-semibold">{t("welcome.title")}</h1>
      </div>

      {hasExisting && service.status !== "unknown" && (
        <div className="rounded-xl border dark:border-emerald-500/30 border-emerald-500/50 dark:bg-emerald-500/5 bg-emerald-50 p-2.5 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg dark:bg-emerald-500/15 bg-emerald-100 dark:text-emerald-300 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <MonitorPlay className="w-3.5 h-3.5" />
            </div>
            <div className="text-[12.5px]">
              <span className="font-bold dark:text-emerald-200 text-emerald-800">
                {t("welcome.existing")}
              </span>
              <span className="dark:text-emerald-300/80 text-emerald-700">{t("welcome.existingSub")}</span>
            </div>
          </div>
          <button
            onClick={() => go("manage")}
            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-[11.5px] font-bold transition shadow flex-shrink-0"
          >
            {t("welcome.openManager")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
        <ModeCard
          mode="host"
          active={installMode === "host"}
          onClick={() => setInstallMode("host")}
        />
        <ModeCard
          mode="docker"
          active={installMode === "docker"}
          onClick={() => setInstallMode("docker")}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0 mt-1">
        <div className="rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-3 space-y-1.5 shadow-sm min-w-0">
          <label className="text-[11px] font-bold dark:text-slate-200 text-slate-800">
            {t("welcome.dirLabel")}
          </label>
          <input
            type="text"
            value={installDir}
            onChange={(e) => {
              setInstallDir(e.target.value);
              void validate(e.target.value);
            }}
            onBlur={(e) => validate(e.target.value)}
            disabled={loading}
            placeholder="D:\ComfyUI"
            className={`w-full px-3 py-2 rounded-lg dark:bg-slate-950/60 bg-slate-50 border text-sm outline-none focus:ring-2 focus:ring-brand-500/30 transition dark:placeholder:text-slate-600 placeholder:text-slate-500 font-medium ${
              installDirError
                ? "border-red-500"
                : "dark:border-slate-700 border-slate-300 focus:border-brand-500"
            } dark:text-slate-100 text-slate-900 min-w-0`}
          />
          {installDirError ? (
            <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 truncate">{installDirError}</div>
          ) : (
            <div className="text-[11px] dark:text-slate-500 text-slate-700 font-medium truncate">
              {t("welcome.dirHint")}
            </div>
          )}
        </div>

        <div className="flex flex-col items-stretch justify-end gap-2 min-w-0">
          <button
            disabled={!!installDirError || loading}
            onClick={continueNext}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition shadow-lg shadow-brand-500/20 w-full h-full"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : "hidden"}`}
            />
            {installMode === "docker"
              ? t("welcome.nextDocker")
              : t("welcome.nextHost")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
