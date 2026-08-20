import {
  CheckCircle2,
  FolderOpen,
  Image,
  Play,
  ArrowLeft,
  Settings,
  Workflow,
} from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { PRESET_WORKFLOWS } from "../lib/presetWorkflows";
import { HardwareGauges } from "../components/HardwareGauges";
import { useT, useLocalize } from "../lib/i18n";

export default function Complete() {
  const t = useT();
  const L = useLocalize();
  const gpuInfo = useInstallerStore((s) => s.gpuInfo);
  const systemInfo = useInstallerStore((s) => s.systemInfo);
  const pythonInfo = useInstallerStore((s) => s.pythonInfo);
  const installDir = useInstallerStore((s) => s.installDir);
  const installMode = useInstallerStore((s) => s.installMode);
  const pythonExe = useInstallerStore((s) => s.pythonExe);
  const go = useInstallerStore((s) => s.go);
  const versionsConfig = useInstallerStore((s) => s.versionsConfig);
  const setServiceStatus = useInstallerStore((s) => s.setServiceStatus);
  const appendLog = useInstallerStore((s) => s.appendLog);
  const manifestContent = useInstallerStore((s) => s.manifestContent);

  const presetWorkflows = manifestContent?.workflows?.length
    ? manifestContent.workflows
    : PRESET_WORKFLOWS;

  const goManage = () => go("manage");

  const launchAndManage = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      setServiceStatus({ status: "starting" });
      const res: any = await invoke("start_service", {
        installDir,
        installMode,
      });
      appendLog(t("service.log.start", { res: JSON.stringify(res) }));
      setServiceStatus(res);
      go("manage");
    } catch (e: any) {
      const msg = e?.toString?.() ?? String(e);
      appendLog(t("service.log.startFailed", { msg }));
      setServiceStatus({
        status: "error",
        last_error: msg,
      });
      go("manage");
    }
  };

  const openFolder = async () => {
    try {
      const mod = await import("@tauri-apps/plugin-shell");
      await mod.open(installDir);
    } catch (e: any) {
      appendLog(t("complete.log.openDirFailed", { msg: e?.toString?.() ?? e }));
    }
  };

  const modelsDir =
    installMode === "docker"
      ? `${installDir}\\data\\models`
      : `${installDir}\\ComfyUI\\models`;
  const comfyuiVersionLabel =
    versionsConfig?.comfyui?.selection_mode === "custom"
      ? versionsConfig?.comfyui?.selected_ref ??
        versionsConfig?.comfyui?.target_branch ??
        "-"
      : t("welcome.latest");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => go("welcome")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-400 hover:border-slate-600 text-slate-800 hover:text-slate-900 transition bg-white/80 dark:bg-transparent text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> {t("complete.backHome")}
        </button>
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold dark:text-slate-100 text-slate-900">
            {t("complete.title")}
          </h2>
          <p className="text-xs dark:text-slate-400 text-slate-600">
            {t("complete.modelsDir")}
            <code className="ml-1 px-1.5 py-0.5 dark:bg-slate-800 bg-slate-200 rounded text-[11px] dark:text-slate-200 text-slate-700">
              {modelsDir}
            </code>
          </p>
        </div>
      </div>

      <div className="rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3.5">
          <SummaryRow
            k={t("complete.deploy")}
            v={installMode === "docker" ? t("app.subtitle.container") : t("app.subtitle.host")}
            ok
          />
          <SummaryRow k="ComfyUI" v={comfyuiVersionLabel} ok />
          <SummaryRow
            k="Python"
            v={
              installMode === "docker"
                ? t("complete.builtinPython")
                : pythonInfo?.found
                ? pythonInfo.version
                : versionsConfig?.python?.version ?? ""
            }
            hint={installMode === "docker" ? undefined : pythonExe || undefined}
            ok={installMode === "docker" ? true : pythonInfo?.is_compatible === true}
          />
          <SummaryRow
            k={t("complete.accel")}
            v={gpuInfo?.has_nvidia ? "CUDA" : "CPU"}
            ok={!!gpuInfo?.has_nvidia}
          />
          <SummaryRow k={t("complete.installLocation")} v={installDir} ok />
        </div>
      </div>

      <div className="rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-3">
          {t("console.hardware")}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HardwareGauges gpuInfo={gpuInfo} systemInfo={systemInfo} />
        </div>
      </div>

      <div className="rounded-xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Image className="w-4 h-4 text-brand-500 dark:text-brand-400" />
          <h3 className="text-sm font-semibold dark:text-slate-100 text-slate-900">
            {t("complete.presetWorkflows", { n: presetWorkflows.length })}
          </h3>
          <span className="text-[11px] dark:text-slate-500 text-slate-600">
            {t("complete.presetHint")}
          </span>
        </div>
        <div className="space-y-2">
          {presetWorkflows.map((w) => (
            <div
              key={w.id}
              className="flex items-start gap-2.5 rounded-lg border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50 p-3"
            >
              <Workflow className="w-4 h-4 text-brand-500 dark:text-brand-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold dark:text-white text-slate-900">
                  {L(w.name)}
                </div>
                <div className="text-[11px] dark:text-slate-400 text-slate-600">
                  {L(w.description)}
                </div>
                {w.dependencies.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {w.dependencies.map((d) => (
                      <span
                        key={d.name}
                        className="px-2 py-0.5 rounded-md text-[10.5px] font-medium dark:bg-slate-800 dark:text-slate-400 bg-slate-200 text-slate-600"
                      >
                        {L(d.label)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={goManage}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold transition shadow-lg shadow-brand-500/20"
        >
          <Settings className="w-4 h-4" /> {t("welcome.openManager")}
        </button>
        <button
          onClick={launchAndManage}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-900 transition shadow-lg shadow-emerald-500/20"
        >
          <Play className="w-4 h-4 fill-current" /> {t("complete.launch")}
        </button>
        <button
          onClick={openFolder}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border dark:border-slate-700 dark:hover:border-slate-500 border-slate-400 hover:border-slate-600 text-sm dark:text-slate-200 dark:hover:text-white text-slate-700 hover:text-slate-900 transition"
        >
          <FolderOpen className="w-4 h-4" /> {t("complete.openDir")}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({
  k,
  v,
  hint,
  ok,
}: {
  k: string;
  v: string;
  hint?: string;
  ok?: boolean;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wider dark:text-slate-500 text-slate-500">
        {k}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-sm font-semibold dark:text-white text-slate-900 truncate">
          {v}
        </div>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            ok ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"
          }`}
        />
      </div>
      {hint && (
        <div className="text-[11px] dark:text-slate-400 text-slate-500 truncate">
          {hint}
        </div>
      )}
    </div>
  );
}
