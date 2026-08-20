import { useMemo, useState } from "react";
import { Download, FolderOpen, HardDrive, Loader2, ScanLine, Trash2 } from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { PRESET_MODELS, PresetModel } from "../lib/presetModels";
import { openPath } from "../lib/window";
import { reportContentEvent } from "../lib/telemetry";
import { formatBytes } from "../lib/utils";
import { useT, useLocalize } from "../lib/i18n";

type TabKey = "models" | "nodes";

export function ModelManager() {
  const t = useT();
  const L = useLocalize();
  const installDir = useInstallerStore((s) => s.installDir);
  const manifestContent = useInstallerStore((s) => s.manifestContent);
  const presetModels = manifestContent?.models?.length ? manifestContent.models : PRESET_MODELS;
  const models = useInstallerStore((s) => s.models);
  const modelCategories = useInstallerStore((s) => s.modelCategories);
  const nodes = useInstallerStore((s) => s.nodes);
  const resourcesScanning = useInstallerStore((s) => s.resourcesScanning);
  const runScanResources = useInstallerStore((s) => s.runScanResources);
  const modelDownloads = useInstallerStore((s) => s.modelDownloads);
  const downloadModel = useInstallerStore((s) => s.downloadModel);
  const deleteModel = useInstallerStore((s) => s.deleteModel);
  const deleteNode = useInstallerStore((s) => s.deleteNode);

  const modelsDir = useMemo(() => (installDir ? `${installDir}\\ComfyUI\\models` : ""), [installDir]);
  const nodesDir = useMemo(() => (installDir ? `${installDir}\\ComfyUI\\custom_nodes` : ""), [installDir]);
  const totalModelsSize = useMemo(() => models.reduce((a, m) => a + m.size_bytes, 0), [models]);

  const [tab, setTab] = useState<TabKey>("models");
  const [modelCategory, setModelCategory] = useState<string>("all");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deletingNode, setDeletingNode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredModels = useMemo(() => {
    if (modelCategory === "all") return models;
    return models.filter((m) => m.category === modelCategory);
  }, [models, modelCategory]);

  const installedName = (p: PresetModel) => models.some((m) => m.name === p.fileName);

  const download = (p: PresetModel) => {
    setError(null);
    reportContentEvent("model", p.id, "download");
    void downloadModel(p.category, p.fileName, p.url);
  };

  const remove = async (fileName: string, dir: string) => {
    if (!window.confirm(t("model.confirmDelete", { name: fileName }))) return;
    setDeletingKey(dir + "/" + fileName);
    setError(null);
    try {
      await deleteModel(dir, fileName);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDeletingKey(null);
    }
  };

  const removeNode = async (name: string) => {
    if (!window.confirm(t("model.confirmDeleteNode", { name }))) return;
    setDeletingNode(name);
    setError(null);
    try {
      await deleteNode(name);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDeletingNode(null);
    }
  };

  const openDir = () => openPath(tab === "models" ? modelsDir : nodesDir);

  return (
    <div className="flex-1 min-h-0 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/70 bg-white/95 backdrop-blur p-3 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
        <div className="inline-flex items-center gap-1 rounded-full border dark:border-slate-700 border-slate-300 dark:bg-slate-950/40 bg-slate-100 p-1">
          <button
            onClick={() => setTab("models")}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold transition ${
              tab === "models"
                ? "bg-brand-500 text-white"
                : "dark:text-slate-300 text-slate-600 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t("model.tab.models")} {models.length}
          </button>
          <button
            onClick={() => setTab("nodes")}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold transition ${
              tab === "nodes"
                ? "bg-brand-500 text-white"
                : "dark:text-slate-300 text-slate-600 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t("model.tab.nodes")} {nodes.length}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openDir}
            disabled={!installDir}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 text-[12px] font-semibold transition disabled:opacity-40"
          >
            <FolderOpen className="w-3.5 h-3.5" /> {tab === "models" ? t("model.dir.models") : t("model.dir.nodes")}
          </button>
          <button
            onClick={runScanResources}
            disabled={resourcesScanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 text-[12px] font-semibold transition disabled:opacity-40"
          >
            <ScanLine className={`w-3.5 h-3.5 ${resourcesScanning ? "animate-spin" : ""}`} />
            {resourcesScanning ? t("common.scanning") : t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-500/40 dark:bg-rose-500/10 bg-rose-50 dark:text-rose-200 text-rose-800 px-3.5 py-2.5 text-[12px] break-all flex-shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {tab === "models" ? (
          <div className="space-y-4">
            <section>
              <div className="text-[11px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600 mb-2">
                {t("model.preset")}
              </div>
              <div className="space-y-1.5">
                {presetModels.map((p) => {
                  const done = installedName(p);
                  const dl = modelDownloads[p.fileName];
                  const downloading = dl?.status === "downloading";
                  const failed = dl?.status === "error";
                  const pct =
                    dl && dl.total > 0 ? Math.min(100, Math.round((dl.downloaded / dl.total) * 100)) : 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12.5px] font-semibold truncate dark:text-slate-100 text-slate-800">
                            {L(p.name)}
                          </span>
                          <span className="text-[10.5px] dark:text-slate-500 text-slate-500 flex-shrink-0">
                            {p.fileName} · {L(p.sizeHint)}
                          </span>
                        </div>
                        <div className="text-[11px] leading-relaxed dark:text-slate-400 text-slate-600 line-clamp-1">
                          {L(p.description)}
                        </div>
                      </div>
                      <button
                        onClick={() => download(p)}
                        disabled={done || downloading}
                        title={failed ? dl?.error : done ? t("wf.installed") : t("model.downloadTitle")}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[12px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                          failed ? "bg-red-500 hover:bg-red-400" : "bg-brand-500 hover:bg-brand-400"
                        }`}
                      >
                        {downloading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        {downloading ? `${pct}%` : done ? t("wf.installed") : failed ? t("model.retry") : t("model.download")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600">
                  {t("model.installed")}
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] dark:text-slate-500 text-slate-600">
                  <HardDrive className="w-3.5 h-3.5" />
                  {formatBytes(totalModelsSize)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <button
                  onClick={() => setModelCategory("all")}
                  className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition ${
                    modelCategory === "all"
                      ? "bg-brand-500 text-white"
                      : "border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                  }`}
                >
                  {t("model.all")} {models.length}
                </button>
                {modelCategories.map((c) => (
                  <button
                    key={c.category}
                    onClick={() => setModelCategory(c.category)}
                    className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition ${
                      modelCategory === c.category
                        ? "bg-brand-500 text-white"
                        : "border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                    }`}
                  >
                    {c.category} {c.count}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                {filteredModels.map((m) => (
                  <div
                    key={m.path}
                    className="flex items-center justify-between gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium truncate dark:text-slate-200 text-slate-800">{m.name}</div>
                      <div className="text-[10.5px] dark:text-slate-500 text-slate-500">{m.category} · {formatBytes(m.size_bytes)}</div>
                    </div>
                    <button
                      onClick={() => remove(m.name, m.dir)}
                      disabled={deletingKey === m.dir + "/" + m.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border dark:border-red-500/40 dark:text-red-400 dark:hover:text-red-300 border-red-300 text-red-600 hover:text-red-700 dark:hover:border-red-400 dark:bg-red-500/10 bg-red-50 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      title={t("model.deleteTitle")}
                    >
                      {deletingKey === m.dir + "/" + m.name ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      {deletingKey === m.dir + "/" + m.name ? t("model.deleting") : t("model.delete")}
                    </button>
                  </div>
                ))}
                {filteredModels.length === 0 && (
                  <div className="text-[12px] dark:text-slate-400 text-slate-500 py-6 text-center">{t("model.noModels")}</div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-1.5">
            {nodes.map((n) => (
              <div
                key={n.path}
                className="flex items-center justify-between gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${n.disabled ? "bg-slate-400" : "bg-emerald-500"}`} />
                  <div className="text-[12.5px] font-medium truncate dark:text-slate-200 text-slate-800">{n.name}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openPath(n.path)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 text-[11px] font-semibold transition"
                  >
                    <FolderOpen className="w-3 h-3" /> {t("common.open")}
                  </button>
                  <button
                    onClick={() => removeNode(n.name)}
                    disabled={deletingNode === n.name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border dark:border-red-500/40 dark:text-red-400 dark:hover:text-red-300 border-red-300 text-red-600 hover:text-red-700 dark:hover:border-red-400 dark:bg-red-500/10 bg-red-50 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t("model.deleteNodeTitle")}
                  >
                    {deletingNode === n.name ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    {deletingNode === n.name ? t("model.deleting") : t("model.delete")}
                  </button>
                </div>
              </div>
            ))}
            {nodes.length === 0 && (
              <div className="text-[12px] dark:text-slate-400 text-slate-500 py-6 text-center">{t("model.noNodes")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
