import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
  ScanLine,
  Sparkles,
  Stethoscope,
  Trash2,
  Workflow,
  Wrench,
} from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { PRESET_WORKFLOWS, PresetWorkflow, WorkflowDependency } from "../lib/presetWorkflows";
import { PRESET_MODELS, PresetModel } from "../lib/presetModels";
import { isTauri } from "../lib/env";
import { reportContentEvent } from "../lib/telemetry";
import { formatBytes } from "../lib/utils";
import { lookupGpu } from "../lib/gpuDatabase";
import { useT, useLocalize } from "../lib/i18n";

// 去掉扩展名后做小写归一化，用于模型文件名比对
function normName(n: string) {
  return n.toLowerCase().replace(/\.[^.]+$/, "");
}

function modelMatches(modelName: string, depName: string) {
  return (
    normName(modelName) === normName(depName) ||
    modelName.toLowerCase() === depName.toLowerCase()
  );
}

function nodeMatches(nodeName: string, depName: string) {
  return nodeName.toLowerCase() === depName.toLowerCase();
}

type SectionKey = "official" | "zhirai" | "diagnosis";

const SECTIONS: { key: SectionKey; labelKey: string }[] = [
  { key: "official", labelKey: "wf.section.official" },
  { key: "zhirai", labelKey: "wf.section.zhirai" },
  { key: "diagnosis", labelKey: "wf.section.diagnosis" },
];

function TagPill({ text, cls }: { text: string; cls: string }) {
  return <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold leading-none ${cls}`}>{text}</span>;
}

export function WorkflowMarket({
  serviceUrl,
  serviceRunning,
  onOpenUi,
  onRestart,
}: {
  serviceUrl: string;
  serviceRunning: boolean;
  onOpenUi: () => void;
  onRestart: () => void;
}) {
  const installDir = useInstallerStore((s) => s.installDir);
  const workflows = useInstallerStore((s) => s.workflows);
  const models = useInstallerStore((s) => s.models);
  const nodes = useInstallerStore((s) => s.nodes);
  const resourcesScanning = useInstallerStore((s) => s.resourcesScanning);
  const runScanResources = useInstallerStore((s) => s.runScanResources);
  const appendLog = useInstallerStore((s) => s.appendLog);
  const downloadModel = useInstallerStore((s) => s.downloadModel);
  const modelDownloads = useInstallerStore((s) => s.modelDownloads);
  const manifestContent = useInstallerStore((s) => s.manifestContent);
  const installTranslateNode = useInstallerStore((s) => s.installTranslateNode);
  const gpuInfo = useInstallerStore((s) => s.gpuInfo);
  const setGpuInfo = useInstallerStore((s) => s.setGpuInfo);

  const blueprints = useInstallerStore((s) => s.blueprints);
  const blueprintsScanning = useInstallerStore((s) => s.blueprintsScanning);
  const scanBlueprints = useInstallerStore((s) => s.scanBlueprints);
  const diagnosis = useInstallerStore((s) => s.diagnosis);
  const diagnosisLoading = useInstallerStore((s) => s.diagnosisLoading);
  const diagnosisError = useInstallerStore((s) => s.diagnosisError);
  const analyzeWorkflow = useInstallerStore((s) => s.analyzeWorkflow);

  const t = useT();
  const L = useLocalize();

  const presetWorkflows = manifestContent?.workflows?.length
    ? manifestContent.workflows
    : PRESET_WORKFLOWS;
  const presetModels = manifestContent?.models?.length ? manifestContent.models : PRESET_MODELS;

  const [section, setSection] = useState<SectionKey>("official");
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixingDepKey, setFixingDepKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [needRestart, setNeedRestart] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  // 待下载模型文件名的集合，全部下载完成后触发“需重启”提示
  const pendingDownloadsRef = useRef<Set<string>>(new Set());
  const onRestartRef = useRef(onRestart);
  onRestartRef.current = onRestart;
  const tRef = useRef(t);
  tRef.current = t;

  // 进入工作流中心时刷新一次本地资源 + 读取官方模板，确保依赖状态是最新的
  useEffect(() => {
    void runScanResources();
    void scanBlueprints();
    // GPU 显存是标注“能否运行”的依据，缺失时补一次检测
    if (!gpuInfo && isTauri()) {
      (async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const g: any = await invoke("detect_gpu");
          if (g?.gpu_name || g?.has_nvidia !== undefined) setGpuInfo(g);
        } catch {}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听模型下载：本次修复批次的所有下载完成后，提示重启并弹出确认框
  useEffect(() => {
    const pending = pendingDownloadsRef.current;
    if (pending.size === 0) return;
    const stillDownloading = [...pending].some(
      (fn) => modelDownloads[fn]?.status === "downloading"
    );
    if (stillDownloading) return;
    pending.clear();
    setMsg(tRef.current("wf.installDoneNeedRestart"));
    setNeedRestart(true);
    if (window.confirm(tRef.current("wf.restartConfirm"))) {
      setMsg(null);
      setNeedRestart(false);
      onRestartRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelDownloads]);

  const installed = (p: PresetWorkflow) => workflows.some((w) => w.name === p.fileName);

  const depState = (d: WorkflowDependency): "ok" | "missing" | "manual" => {
    if (d.kind === "manual") return "manual";
    if (d.kind === "model") {
      return models.some((m) => modelMatches(m.name, d.name)) ? "ok" : "missing";
    }
    return nodes.some((n) => nodeMatches(n.name, d.name)) ? "ok" : "missing";
  };

  const missingDeps = (p: PresetWorkflow) => p.dependencies.filter((d) => depState(d) === "missing");
  const manualDeps = (p: PresetWorkflow) => p.dependencies.filter((d) => depState(d) === "manual");

  const fixableMissing = (p: PresetWorkflow): PresetModel[] =>
    p.dependencies
      .filter((d) => d.kind === "model" && depState(d) === "missing")
      .map((d) => presetModels.find((m) => m.fileName.toLowerCase() === d.name.toLowerCase()))
      .filter((m): m is PresetModel => !!m);

  const fixableNodes = (p: PresetWorkflow): WorkflowDependency[] =>
    p.dependencies.filter(
      (d) => d.kind === "node" && depState(d) === "missing" && !!d.git_url
    );

  const fixing = (p: PresetWorkflow) =>
    fixingId === p.id ||
    fixableMissing(p).some((m) => modelDownloads[m.fileName]?.status === "downloading");

  const nodePackMissing = (p: PresetWorkflow) =>
    (p.needsTranslate || p.needsLlm || p.needsTts) &&
    !nodes.some((n) => nodeMatches(n.name, "comfyui-translate-zh"));

  // 对单个工作流执行修复：安装节点 + 下载模型。返回是否真的做了事。
  const applyFix = async (p: PresetWorkflow): Promise<boolean> => {
    const fresh = useInstallerStore.getState();
    const fixable = p.dependencies
      .filter((d) => d.kind === "model" && !fresh.models.some((m) => modelMatches(m.name, d.name)))
      .map((d) => presetModels.find((m) => m.fileName.toLowerCase() === d.name.toLowerCase()))
      .filter((m): m is PresetModel => !!m);
    const nodesToFix = p.dependencies.filter(
      (d) => d.kind === "node" && !fresh.nodes.some((n) => nodeMatches(n.name, d.name)) && !!d.git_url
    );
    const needNodePack =
      (p.needsTranslate || p.needsLlm || p.needsTts) &&
      !fresh.nodes.some((n) => nodeMatches(n.name, "comfyui-translate-zh"));

    if (fixable.length === 0 && nodesToFix.length === 0 && !needNodePack) return false;

    if (nodesToFix.length > 0) {
      const { invoke } = await import("@tauri-apps/api/core");
      for (const d of nodesToFix) {
        const r: string = await invoke("install_custom_node", {
          installDir,
          nodeName: d.name,
          gitUrl: d.git_url,
        });
        appendLog(`[node] ${r}`);
      }
      // 节点安装完成后立即刷新，让“缺少节点”即时消失
      await runScanResources();
    }
    if (needNodePack) {
      await installTranslateNode();
    }

    const parts: string[] = [];
    if (nodesToFix.length > 0) parts.push(t("wf.nodesCount", { n: nodesToFix.length }));
    if (needNodePack) parts.push(p.needsLlm ? t("wf.llmNode") : p.needsTts ? t("wf.ttsNode") : t("wf.translateNode"));
    if (fixable.length > 0) parts.push(t("wf.modelsCount", { n: fixable.length }));

    if (fixable.length > 0) {
      for (const m of fixable) {
        pendingDownloadsRef.current.add(m.fileName);
        downloadModel(m.category, m.fileName, m.url);
      }
      setMsg(t("wf.installingDeps", { parts: parts.join(", ") }));
    }
    return true;
  };

  // 批次修复结束：有模型在途时交给 effect 在全部下载完成后提示；否则立即提示重启。
  const finishFix = (didAny: boolean) => {
    if (!didAny) {
      setMsg(t("wf.depsExist"));
      return;
    }
    if (pendingDownloadsRef.current.size > 0) return;
    setMsg(t("wf.installDoneNeedRestart"));
    setNeedRestart(true);
    if (window.confirm(t("wf.restartConfirm"))) {
      setMsg(null);
      setNeedRestart(false);
      onRestartRef.current();
    }
  };

  const fixMissing = async (p: PresetWorkflow) => {
    setFixingId(p.id);
    setMsg(null);
    setNeedRestart(false);
    try {
      await runScanResources();
    } catch {}
    try {
      const did = await applyFix(p);
      finishFix(did);
    } catch (e: any) {
      const m = typeof e === "string" ? e : e?.toString?.() ?? "Error";
      setMsg(t("wf.fixFailed", { msg: m }));
    } finally {
      setFixingId(null);
    }
  };

  // 修复单个缺失依赖：模型走下载、节点走 git 安装；完成后按需提示重启。
  const fixDependency = async (p: PresetWorkflow, dep: WorkflowDependency) => {
    const key = `${p.id}::${dep.name}`;
    setFixingDepKey(key);
    setMsg(null);
    setNeedRestart(false);
    try {
      if (dep.kind === "model") {
        const m = presetModels.find(
          (mm) => mm.fileName.toLowerCase() === dep.name.toLowerCase()
        );
        if (!m) {
          setMsg(t("wf.depsExist"));
          return;
        }
        pendingDownloadsRef.current.add(m.fileName);
        downloadModel(m.category, m.fileName, m.url);
        setMsg(t("wf.installingDeps", { parts: t("wf.modelsCount", { n: 1 }) }));
        return;
      }
      if (dep.kind === "node" && dep.git_url) {
        const { invoke } = await import("@tauri-apps/api/core");
        const r: string = await invoke("install_custom_node", {
          installDir,
          nodeName: dep.name,
          gitUrl: dep.git_url,
        });
        appendLog(`[node] ${r}`);
        await runScanResources();
        setMsg(t("wf.installDoneNeedRestart"));
        setNeedRestart(true);
        if (window.confirm(t("wf.restartConfirm"))) {
          setMsg(null);
          setNeedRestart(false);
          onRestartRef.current();
        }
        return;
      }
    } catch (e: any) {
      const m = typeof e === "string" ? e : e?.toString?.() ?? "Error";
      setMsg(t("wf.fixFailed", { msg: m }));
    } finally {
      setFixingDepKey(null);
    }
  };

  const remove = async (fileName: string) => {
    if (!isTauri() || !installDir) return;
    if (!window.confirm(t("wf.confirmDelete", { name: fileName }))) return;
    setDeletingName(fileName);
    setMsg(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_workflow", { installDir, fileName });
      appendLog(t("wf.logDeleted", { name: fileName }));
      await runScanResources();
    } catch (e: any) {
      const m = e?.toString?.() ?? String(e);
      appendLog(t("wf.logDeleteFailed", { msg: m }));
      setMsg(t("wf.deleteFailed", { msg: m }));
    } finally {
      setDeletingName(null);
    }
  };

  const install = async (p: PresetWorkflow) => {
    setInstallingId(p.id);
    setMsg(null);
    try {
      if (!isTauri() || !installDir) {
        setMsg(t("wf.needTauri"));
        return;
      }
      const { invoke } = await import("@tauri-apps/api/core");
      const content = JSON.stringify(p.graph, null, 2);
      await invoke("install_preset_workflow", {
        installDir,
        fileName: p.fileName,
        content,
      });
      appendLog(t("wf.logInstalled", { name: L(p.name) }));
      if (p.needsTranslate || p.needsLlm || p.needsTts) {
        await installTranslateNode();
      }
      await runScanResources();
      reportContentEvent("workflow", p.id, "install");
      setMsg(
        t("wf.installMsg", { name: L(p.name) }) +
          (p.needsTranslate || p.needsLlm || p.needsTts
            ? " " + t(p.needsLlm ? "wf.llmHint" : p.needsTts ? "wf.ttsHint" : "wf.translateHint")
            : "")
      );
    } catch (e: any) {
      const m = e?.toString?.() ?? String(e);
      appendLog(t("wf.logInstallFailed", { msg: m }));
      setMsg(t("wf.installFailed", { msg: m }));
    } finally {
      setInstallingId(null);
    }
  };

  const diagnose = async (fileName: string) => {
    setSelectedWorkflow(fileName);
    setMsg(null);
    await analyzeWorkflow(fileName);
  };

  const renderDownloadProgress = (fileName: string) => {
    const st = modelDownloads[fileName];
    if (!st || st.status !== "downloading") return null;
    const pct = st.total > 0 ? Math.min(100, Math.round((st.downloaded / st.total) * 100)) : 0;
    return (
      <div className="mt-1">
        <div className="text-[11px] text-brand-600 dark:text-brand-300 font-medium mb-0.5">
          {t("wf.downloading", { name: fileName })}
          {st.total > 0 ? ` · ${pct}%` : ` · ${formatBytes(st.downloaded)}`}
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  const renderZhiraiCard = (p: PresetWorkflow) => {
    const done = installed(p);
    const missing = missingDeps(p);
    const manual = manualDeps(p);
    const canFix = fixableMissing(p).length > 0 || fixableNodes(p).length > 0 || nodePackMissing(p);
    const isFixing = fixing(p);
    const gpuDb = lookupGpu(gpuInfo?.gpu_name);
    const vramGb = gpuInfo?.vram_gb ?? gpuDb?.vramGb ?? 0;
    const gpuLabel = gpuDb?.name ?? gpuInfo?.gpu_name?.trim() ?? "GPU";
    const minVram = p.minVramGb;
    const cannotRun = minVram != null && vramGb > 0 && vramGb < minVram;
    return (
      <div
        key={p.id}
        className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3 flex flex-col gap-1.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Workflow className="w-4 h-4 text-brand-600 dark:text-brand-300 flex-shrink-0" />
              <span className="text-[12.5px] font-semibold dark:text-slate-100 text-slate-800">
                {L(p.name)}
              </span>
              {cannotRun && (
                <TagPill text={t("wf.tag.cannotRun")} cls="bg-rose-500/20 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <div className="mt-1 text-[11.5px] leading-relaxed dark:text-slate-400 text-slate-600 line-clamp-2">
              {L(p.description)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canFix && (
              <button
                onClick={() => fixMissing(p)}
                disabled={isFixing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-white text-[12px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("wf.fixTitle")}
              >
                {isFixing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                {isFixing ? t("wf.fixing") : t("wf.fix")}
              </button>
            )}
            <button
              onClick={() => install(p)}
              disabled={installingId === p.id || done}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {installingId === p.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {installingId === p.id ? t("wf.installing") : done ? t("wf.installed") : t("wf.install")}
            </button>
          </div>
        </div>
        {missing.length > 0 && (
          <div className="text-[11px] text-red-500 dark:text-red-400 font-medium">
            <div>{t("wf.missing")}</div>
            <div className="space-y-1 mt-0.5">
              {missing.map((d) => {
                const depFixable = d.kind === "model" || (d.kind === "node" && !!d.git_url);
                const depKey = `${p.id}::${d.name}`;
                const fixingDep = fixingDepKey === depKey;
                return (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 break-all">{L(d.label)}</span>
                    {depFixable && (
                      <button
                        onClick={() => fixDependency(p, d)}
                        disabled={fixingDep}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/90 hover:bg-red-400 text-white text-[10.5px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title={t("wf.fix")}
                      >
                        {fixingDep ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                        {fixingDep ? t("wf.fixing") : t("wf.fix")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {manual.length > 0 && (
          <div className="text-[11px] text-amber-500 dark:text-amber-400">
            {t("wf.manual")}{manual.map((d) => L(d.label)).join("、")}
          </div>
        )}
        {cannotRun && (
          <div className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">
            {p.gpuHint
              ? t("wf.cannotRunMsg", { hint: L(p.gpuHint), gpu: gpuLabel, vram: vramGb })
              : t("wf.cannotRunMsgNoHint", { min: minVram, gpu: gpuLabel, vram: vramGb })}
          </div>
        )}
        {fixableMissing(p).map((m) => renderDownloadProgress(m.fileName))}
      </div>
    );
  };

  const blueprintModelMissing = (name: string) => !models.some((m) => modelMatches(m.name, name));

  const renderOfficial = () => {
    if (blueprintsScanning) {
      return (
        <div className="text-[12px] dark:text-slate-400 text-slate-500 py-6 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t("wf.official.scanning")}
        </div>
      );
    }
    if (blueprints.length === 0) {
      return (
        <div className="text-[12px] dark:text-slate-400 text-slate-500 py-6 text-center">
          {t("wf.official.noBlueprints")}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {blueprints.map((bp) => (
          <div
            key={bp.file}
            className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <BookOpen className="w-4 h-4 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                  <span className="text-[12.5px] font-semibold dark:text-slate-100 text-slate-800">
                    {bp.title || bp.file}
                  </span>
                </div>
                {bp.category && (
                  <div className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-500 truncate">
                    {bp.category}
                  </div>
                )}
              </div>
            </div>

            {bp.models.length > 0 && (
              <div className="mt-2">
                <div className="text-[10.5px] font-bold uppercase tracking-wide dark:text-slate-500 text-slate-500 mb-1">
                  {t("wf.official.models")}
                </div>
                <div className="space-y-1">
                  {bp.models.map((bm, i) => {
                    const missing = blueprintModelMissing(bm.name);
                    const dl = modelDownloads[bm.name];
                    return (
                      <div key={`${bm.name}-${i}`} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] dark:text-slate-300 text-slate-700 break-all">
                            {bm.name}
                          </div>
                          {bm.directory && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-500">{bm.directory}</div>
                          )}
                          {dl?.status === "downloading" && renderDownloadProgress(bm.name)}
                        </div>
                        {missing && bm.url && bm.directory && (
                          <button
                            onClick={() => downloadModel(bm.directory, bm.name, bm.url)}
                            disabled={dl?.status === "downloading"}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/90 hover:bg-red-400 text-white text-[10.5px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            title={t("model.download")}
                          >
                            {dl?.status === "downloading" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            {dl?.status === "downloading" ? t("wf.fixing") : t("model.download")}
                          </button>
                        )}
                        {!missing && (
                          <span className="text-[10.5px] text-emerald-500 dark:text-emerald-400 flex-shrink-0">
                            {t("wf.diag.ok")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {bp.node_types.length > 0 && (
              <div className="mt-2">
                <div className="text-[10.5px] font-bold uppercase tracking-wide dark:text-slate-500 text-slate-500 mb-1">
                  {t("wf.official.nodes")} ({bp.node_types.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {bp.node_types.map((n) => (
                    <span
                      key={n}
                      className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderZhirai = () => (
    <div className="space-y-1.5">
      {presetWorkflows.map(renderZhiraiCard)}
      {presetWorkflows.length === 0 && (
        <div className="text-[12px] dark:text-slate-400 text-slate-500 py-6 text-center">
          {t("wf.zhirai.empty")}
        </div>
      )}
    </div>
  );

  const renderDiagnosis = () => {
    const missingModels = diagnosis?.missing_models ?? [];
    const missingInputs = diagnosis?.missing_inputs ?? [];
    const missingNodes = diagnosis?.missing_nodes ?? [];
    const apiNodeTypes = diagnosis?.api_node_types ?? [];
    const nodeTypes = diagnosis?.node_types ?? [];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedWorkflow ?? ""}
            onChange={(e) => setSelectedWorkflow(e.target.value || null)}
            className="flex-1 min-w-[200px] rounded-full border dark:border-slate-700 border-slate-300 dark:bg-slate-900/60 bg-white px-3 py-1.5 text-[12px] dark:text-slate-100 text-slate-900 outline-none focus:border-brand-500"
          >
            <option value="" disabled>
              {t("wf.diag.select")}
            </option>
            {workflows.map((w) => (
              <option key={w.path} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedWorkflow && diagnose(selectedWorkflow)}
            disabled={!selectedWorkflow || diagnosisLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {diagnosisLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
            {diagnosisLoading ? t("wf.diag.analyzing") : t("wf.diag.analyze")}
          </button>
        </div>

        {diagnosisError && (
          <div className="rounded-xl border border-red-500/30 dark:bg-red-500/10 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600 dark:text-red-400 break-all">
            {t("wf.diag.error")}: {diagnosisError}
          </div>
        )}

        {diagnosis && (
          <div className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3 space-y-2">
            <div className="text-[12px] font-semibold dark:text-slate-100 text-slate-800 break-all">
              {diagnosis.file_name}
            </div>

            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wide dark:text-slate-500 text-slate-500 mb-1">
                {t("wf.diag.nodes")} ({nodeTypes.length})
              </div>
              {nodeTypes.length ? (
                <div className="flex flex-wrap gap-1">
                  {nodeTypes.map((n) => (
                    <span
                      key={n}
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        missingNodes.includes(n)
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] dark:text-slate-500 text-slate-500">{t("wf.diag.none")}</div>
              )}
              <div className="mt-1 text-[11px]">
                <span className="text-slate-500 dark:text-slate-500">{t("wf.diag.missingNodes")}：</span>
                {missingNodes.length ? (
                  <span className="text-red-500 dark:text-red-400">{missingNodes.join("、")}</span>
                ) : (
                  <span className="text-emerald-500 dark:text-emerald-400">{t("wf.diag.ok")}</span>
                )}
              </div>
              {apiNodeTypes.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-500 dark:text-amber-400">
                  {t("wf.diag.apiNodes")}：{apiNodeTypes.join("、")}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wide dark:text-slate-500 text-slate-500 mb-1">
                {t("wf.diag.models")} ({diagnosis.model_refs.length})
              </div>
              {diagnosis.model_refs.length ? (
                <div className="flex flex-wrap gap-1">
                  {diagnosis.model_refs.map((m) => (
                    <span
                      key={m}
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        missingModels.includes(m)
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] dark:text-slate-500 text-slate-500">{t("wf.diag.none")}</div>
              )}
              <div className="mt-1 text-[11px]">
                <span className="text-slate-500 dark:text-slate-500">{t("wf.diag.missingModels")}：</span>
                {missingModels.length ? (
                  <span className="text-red-500 dark:text-red-400">{missingModels.join("、")}</span>
                ) : (
                  <span className="text-emerald-500 dark:text-emerald-400">{t("wf.diag.ok")}</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wide dark:text-slate-500 text-slate-500 mb-1">
                {t("wf.diag.inputs")} ({diagnosis.input_refs.length})
              </div>
              {diagnosis.input_refs.length ? (
                <div className="flex flex-wrap gap-1">
                  {diagnosis.input_refs.map((f) => (
                    <span
                      key={f}
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        missingInputs.includes(f)
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] dark:text-slate-500 text-slate-500">{t("wf.diag.none")}</div>
              )}
              <div className="mt-1 text-[11px]">
                <span className="text-slate-500 dark:text-slate-500">{t("wf.diag.missingInputs")}：</span>
                {missingInputs.length ? (
                  <span className="text-red-500 dark:text-red-400">{missingInputs.join("、")}</span>
                ) : (
                  <span className="text-emerald-500 dark:text-emerald-400">{t("wf.diag.ok")}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wide dark:text-slate-500 text-slate-500 mb-1">
            {t("wf.tab.mine")} ({workflows.length})
          </div>
          {workflows.length === 0 ? (
            <div className="text-[12px] dark:text-slate-400 text-slate-500 py-4 text-center">
              {t("wf.diag.noWorkflows")}
            </div>
          ) : (
            <div className="space-y-1.5">
              {workflows.map((w) => (
                <div
                  key={w.path}
                  className="flex items-center justify-between gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-2.5"
                >
                  <button
                    onClick={() => diagnose(w.name)}
                    className="flex items-center gap-2.5 min-w-0 text-left"
                    title={t("wf.diag.analyze")}
                  >
                    <Workflow className="w-4 h-4 text-brand-600 dark:text-brand-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium truncate dark:text-slate-200 text-slate-800">
                        {w.name}
                      </div>
                      <div className="text-[10.5px] dark:text-slate-500 text-slate-500">
                        {formatBytes(w.size_bytes)}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={onOpenUi}
                      disabled={!serviceRunning}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title={serviceRunning ? serviceUrl || "http://127.0.0.1:8188" : t("wf.openTitle")}
                    >
                      <ExternalLink className="w-3 h-3" /> {t("common.open")}
                    </button>
                    <button
                      onClick={() => remove(w.name)}
                      disabled={deletingName === w.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border dark:border-red-500/40 dark:text-red-400 dark:hover:text-red-300 border-red-300 text-red-600 hover:text-red-700 dark:hover:border-red-400 dark:bg-red-500/10 bg-red-50 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t("wf.deleteTitle")}
                    >
                      {deletingName === w.name ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      {deletingName === w.name ? t("wf.deleting") : t("wf.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const sectionDesc = useMemo(() => {
    if (section === "official") return t("wf.official.desc");
    if (section === "zhirai") return t("wf.zhirai.desc");
    return t("wf.diag.desc");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  return (
    <div className="flex-1 min-h-0 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/70 bg-white/95 backdrop-blur p-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[13px] font-semibold dark:text-slate-100 text-slate-900">{t("wf.center")}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void runScanResources();
              void scanBlueprints();
            }}
            disabled={resourcesScanning || blueprintsScanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 text-[12px] font-semibold transition disabled:opacity-40"
          >
            <ScanLine className={`w-3.5 h-3.5 ${resourcesScanning || blueprintsScanning ? "animate-spin" : ""}`} />
            {resourcesScanning || blueprintsScanning ? t("common.scanning") : t("common.refresh")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold transition ${
              section === s.key
                ? "bg-brand-500 text-white"
                : "border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      <div className="text-[11px] dark:text-slate-400 text-slate-500 mb-3">{sectionDesc}</div>

      {msg && (
        <div className="mb-3 rounded-xl border border-brand-500/30 dark:bg-brand-500/10 bg-brand-50 px-3.5 py-2.5 text-[12px] dark:text-slate-200 text-slate-700 break-all flex items-center justify-between gap-3">
          <span className="whitespace-pre-wrap">{msg}</span>
          {needRestart && (
            <button
              onClick={() => {
                setMsg(null);
                setNeedRestart(false);
                onRestartRef.current();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12px] font-bold transition flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("wf.restartNow")}
            </button>
          )}
        </div>
      )}

      {section === "official" && (
        <>
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-sky-500" />
            <div className="text-[11px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600">
              {t("wf.official.title")}
            </div>
          </div>
          {renderOfficial()}
        </>
      )}

      {section === "zhirai" && (
        <>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <div className="text-[11px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600">
              {t("wf.section.zhirai")}
            </div>
          </div>
          {renderZhirai()}
        </>
      )}

      {section === "diagnosis" && (
        <>
          <div className="flex items-center gap-1.5 mb-2">
            <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />
            <div className="text-[11px] font-bold tracking-wide uppercase dark:text-slate-500 text-slate-600">
              {t("wf.diag.title")}
            </div>
          </div>
          {renderDiagnosis()}
        </>
      )}
    </div>
  );
}
