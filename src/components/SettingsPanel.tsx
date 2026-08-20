import { useEffect, useState } from "react";
import { FolderOpen, Save } from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { openInstallDir, openPath, openResultsDir } from "../lib/window";
import { useI18n, useT } from "../lib/i18n";

function PathRow({
  title,
  value,
  onOpen,
}: {
  title: string;
  value: string;
  onOpen?: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600">
          {title}
        </div>
        <div className="mt-0.5 font-mono text-[12px] break-all dark:text-slate-200 text-slate-800">
          {value || "-"}
        </div>
      </div>
      {onOpen && (
        <button
          onClick={onOpen}
          disabled={!value}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 text-[12px] font-semibold transition disabled:opacity-40 flex-shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5" /> {t("common.open")}
        </button>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const installDir = useInstallerStore((s) => s.installDir);
  const comfyuiDir = useInstallerStore((s) => s.comfyuiDir);
  const pythonExe = useInstallerStore((s) => s.pythonExe);
  const configPort = useInstallerStore((s) => s.configPort);
  const launchArgs = useInstallerStore((s) => s.launchArgs);
  const saveInstallConfig = useInstallerStore((s) => s.saveInstallConfig);

  const [portInput, setPortInput] = useState("8188");
  const [argsInput, setArgsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);

  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);

  useEffect(() => {
    setPortInput(String(configPort || 8188));
  }, [configPort]);

  useEffect(() => {
    setArgsInput(launchArgs || "");
  }, [launchArgs]);

  const handleSave = async () => {
    const port = Number(portInput);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setMsg(t("sp.portInvalid"));
      setMsgOk(false);
      return;
    }
    setSaving(true);
    const err = await saveInstallConfig(port, argsInput.trim());
    setMsg(err ? t("sp.saveFailed", { err }) : t("sp.saveOk"));
    setMsgOk(!err);
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const resultsDir = installDir ? `${installDir}\\results` : "";
  const modelsDir = installDir ? `${installDir}\\ComfyUI\\models` : "";
  const nodesDir = installDir ? `${installDir}\\ComfyUI\\custom_nodes` : "";
  const workflowsDir = installDir ? `${installDir}\\ComfyUI\\user\\default\\workflows` : "";

  return (
    <div className="flex-1 min-h-0 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/70 bg-white/95 backdrop-blur p-4 overflow-y-auto">
      <div className="text-[13px] font-semibold dark:text-slate-100 text-slate-900 mb-3">{t("sp.title")}</div>

      <div className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3 mb-4">
        <div className="text-[10.5px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600 mb-2">
          {t("common.language")}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLang("zh")}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition border ${lang === "zh" ? "bg-brand-500 text-white border-brand-500" : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-brand-400"}`}
          >
            {t("common.chinese")}
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition border ${lang === "en" ? "bg-brand-500 text-white border-brand-500" : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-brand-400"}`}
          >
            {t("common.english")}
          </button>
        </div>
      </div>

      <div className="text-[11px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600 mb-2">
        {t("sp.comfyuiEnv")}
      </div>
      <div className="space-y-2.5">
        <PathRow title={t("sp.comfyuiPath")} value={comfyuiDir} onOpen={() => openPath(comfyuiDir)} />
        <PathRow title={t("sp.pythonPath")} value={pythonExe} />

        <div className="flex items-center gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600">
              {t("sp.port")}
            </div>
            <input
              value={portInput}
              onChange={(e) => setPortInput(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-1 w-full rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white px-3 py-1.5 text-[13px] font-mono dark:text-slate-100 text-slate-900 outline-none focus:border-brand-500"
              placeholder="8188"
            />
          </div>
        </div>

        <div className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3">
          <div className="text-[10.5px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600 mb-1.5">
            {t("sp.launchArgs")}
          </div>
          <input
            value={argsInput}
            onChange={(e) => setArgsInput(e.target.value)}
            className="w-full rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white px-3 py-1.5 text-[13px] font-mono dark:text-slate-100 text-slate-900 outline-none focus:border-brand-500"
            placeholder={t("sp.launchArgsPlaceholder")}
          />
          <div className="mt-1 text-[10.5px] dark:text-slate-500 text-slate-500">
            {t("sp.launchArgsHint")}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12.5px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {t("sp.save")}
          </button>
          {msg && (
            <span className={`text-[12px] font-semibold ${msgOk ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {msg}
            </span>
          )}
        </div>
      </div>

      <div className="text-[11px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600 mt-5 mb-2">
        {t("sp.dirs")}
      </div>
      <div className="space-y-2.5">
        <PathRow title={t("sp.installDir")} value={installDir} onOpen={() => openInstallDir(installDir)} />
        <PathRow title={t("sp.resultsDir")} value={resultsDir} onOpen={() => openResultsDir(installDir)} />
        <PathRow title={t("sp.modelsDir")} value={modelsDir} onOpen={() => openPath(modelsDir)} />
        <PathRow title={t("sp.nodesDir")} value={nodesDir} onOpen={() => openPath(nodesDir)} />
        <PathRow title={t("sp.workflowsDir")} value={workflowsDir} onOpen={() => openPath(workflowsDir)} />
      </div>
    </div>
  );
}
