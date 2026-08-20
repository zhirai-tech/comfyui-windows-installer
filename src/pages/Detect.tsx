import { ArrowLeft, ArrowRight, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import GPUInfo from "../components/GPUInfo";
import { useInstallerStore } from "../store/installerStore";
import { isTauri } from "../lib/env";
import { sleep } from "../lib/utils";
import { useT } from "../lib/i18n";

import type {
  SystemInfo,
  GpuInfo,
  PythonInfo,
  DockerInfo,
} from "../store/installerStore";

export default function Detect() {
  const t = useT();
  const go = useInstallerStore((s) => s.go);
  const systemInfo = useInstallerStore((s) => s.systemInfo);
  const setSystemInfo = useInstallerStore((s) => s.setSystemInfo);
  const gpuInfo = useInstallerStore((s) => s.gpuInfo);
  const setGpuInfo = useInstallerStore((s) => s.setGpuInfo);
  const pythonInfo = useInstallerStore((s) => s.pythonInfo);
  const setPythonInfo = useInstallerStore((s) => s.setPythonInfo);
  const dockerInfo = useInstallerStore((s) => s.dockerInfo);
  const setDockerInfo = useInstallerStore((s) => s.setDockerInfo);
  const installMode = useInstallerStore((s) => s.installMode);
  const installDir = useInstallerStore((s) => s.installDir);
  const appendLog = useInstallerStore((s) => s.appendLog);

  const [busy, setBusy] = useState(true);
  const [phase, setPhase] =
    useState<"idle" | "system" | "gpu" | "env" | "deps" | "done">("idle");
  const envIsTauriPromise = useRef<boolean>(isTauri());

  const run = async () => {
    setBusy(true);
    setPhase("idle");

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const sys = await invoke<any>("detect_system", { installDir });
      setPhase("system");
      setSystemInfo(sys);
    } catch (e: any) {
      appendLog(`[error] ${t("detect.errorSystem")}: ${e}`);
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const gpu = await invoke<any>("detect_gpu");
      setPhase("gpu");
      setGpuInfo(gpu);
    } catch (e: any) {
      appendLog(`[error] ${t("detect.errorGpu")}: ${e}`);
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const py = await invoke<any>("detect_python");
      setPhase("env");
      setPythonInfo(py);
    } catch (e: any) {
      appendLog(`[error] ${t("detect.errorPython")}: ${e}`);
    }
    if (installMode === "docker") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const d = await invoke<any>("check_docker");
        setPhase("deps");
        setDockerInfo(d);
      } catch (e: any) {
        appendLog(`[error] ${t("detect.errorDocker")}: ${e}`);
      }
    }
    setPhase("deps");
    await sleep(200);
    setPhase("done");
    setBusy(false);
  };

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go("welcome")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-400 hover:border-slate-600 text-slate-800 hover:text-slate-900 transition bg-white/80 dark:bg-transparent text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {t("common.back")}
          </button>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {busy ? (
              <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
            ) : (
              <span className="w-4 h-4 rounded bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-[10px]">
                ✓
              </span>
            )}
            {busy ? t("detect.checking") : t("detect.result")}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {installMode === "host" && pythonInfo && !pythonInfo.found && !busy && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-700/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10.5px] font-bold shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" />
              {t("detect.noPython")}
            </span>
          )}
          {installMode === "docker" && dockerInfo && !dockerInfo.installed && !busy && (
            <a
              href="https://www.docker.com/products/docker-desktop/"
              target="_blank"
              rel="noreferrer noopener"
              onClick={async (e) => {
                e.preventDefault();
                const href = "https://www.docker.com/products/docker-desktop/";
                if (envIsTauriPromise.current) {
                  try {
                    const m = await import("@tauri-apps/plugin-shell");
                    await m.open(href);
                    return;
                  } catch {}
                }
                window.open(href, "_blank");
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-700/40 bg-rose-500/15 text-rose-800 dark:text-rose-300 text-[10.5px] font-bold hover:bg-rose-500/20 transition shadow-sm"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {t("detect.noDocker")}
            </a>
          )}
          <button
            onClick={() => void run()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-500 hover:border-slate-700 text-slate-800 hover:text-slate-900 transition disabled:opacity-50 bg-white/80 dark:bg-transparent"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
            {t("detect.redetect")}
          </button>
        </div>
      </div>

      <GPUInfo
        systemInfo={systemInfo}
        gpuInfo={gpuInfo}
        pythonInfo={pythonInfo}
        dockerInfo={dockerInfo}
        installMode={installMode}
        detectPhase={phase}
      />

      <div className="flex items-center justify-end pt-3 border-t dark:border-slate-800 border-slate-200 mt-2">
        <button
          disabled={busy}
          onClick={() => go("install")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-sm font-semibold shadow-lg shadow-brand-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {installMode === "host" && pythonInfo && !pythonInfo.found
            ? t("detect.nextPython")
            : installMode === "docker" && dockerInfo && !dockerInfo.installed
            ? t("detect.nextDocker")
            : t("detect.start")}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
