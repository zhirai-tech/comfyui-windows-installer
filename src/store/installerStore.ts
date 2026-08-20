import { create } from "zustand";
import { isTauri } from "../lib/env";
import { translate, useI18n } from "../lib/i18n";
import type { InstallerStore, ServiceStatus, StepState } from "./types";

export * from "./types";

const tr = (key: string, vars?: Record<string, string | number>) =>
  translate(useI18n.getState().lang, key, vars);

const HOST_STEPS: StepState[] = [
  { key: "python", label: "准备 Python 环境", status: "pending", progress: 0 },
  { key: "comfyui", label: "下载 ComfyUI", status: "pending", progress: 0 },
  { key: "venv", label: "创建虚拟环境", status: "pending", progress: 0 },
  { key: "pytorch", label: "安装 PyTorch", status: "pending", progress: 0 },
  { key: "deps", label: "安装 ComfyUI 依赖", status: "pending", progress: 0 },
  { key: "config", label: "配置启动器 & 服务管理", status: "pending", progress: 0 },
];

const DOCKER_STEPS: StepState[] = [
  { key: "docker_check", label: "检测 Docker Desktop", status: "pending", progress: 0 },
  { key: "data", label: "准备数据目录 & 配置文件", status: "pending", progress: 0 },
  { key: "docker_pull", label: "拉取 ComfyUI 镜像（耐心等待）", status: "pending", progress: 0 },
  { key: "compose", label: "验证 docker-compose", status: "pending", progress: 0 },
  { key: "config", label: "写入安装配置 & 服务管理", status: "pending", progress: 0 },
];

export const useInstallerStore = create<InstallerStore>((set, get) => ({
  page: "welcome",
  go: (p) => set({ page: p }),

  installMode: "host",
  setInstallMode: (m) => {
    set({ installMode: m });
    get().rebuildStepsForMode();
  },

  comfyuiVersionMode: (() => {
    try {
      return (localStorage.getItem("comfyuiVersionMode") as InstallerStore["comfyuiVersionMode"]) || "latest";
    } catch {
      return "latest";
    }
  })(),
  comfyuiVersionRef: (() => {
    try {
      return localStorage.getItem("comfyuiVersionRef") || "";
    } catch {
      return "";
    }
  })(),
  setComfyuiVersionSelection: (mode, ref) => {
    set({ comfyuiVersionMode: mode, comfyuiVersionRef: ref });
    try {
      localStorage.setItem("comfyuiVersionMode", mode);
      localStorage.setItem("comfyuiVersionRef", ref);
    } catch {}
  },

  versionsConfig: null,
  setVersionsConfig: (v) => set({ versionsConfig: v }),

  manifestContent: null,
  setManifestContent: (m) => set({ manifestContent: m }),
  appVersion: "",
  setAppVersion: (v) => set({ appVersion: v }),
  updateInfo: null,
  setUpdateInfo: (u) => set({ updateInfo: u }),

  systemInfo: null,
  setSystemInfo: (s) => set({ systemInfo: s }),

  gpuInfo: null,
  setGpuInfo: (g) => set({ gpuInfo: g }),

  pythonInfo: null,
  setPythonInfo: (p) => set({ pythonInfo: p }),

  dockerInfo: null,
  setDockerInfo: (d) => set({ dockerInfo: d }),

  installDir: (() => {
    try {
      return localStorage.getItem("installDir") || "D:\\ComfyUI";
    } catch {
      return "D:\\ComfyUI";
    }
  })(),
  setInstallDir: (d) => {
    set({ installDir: d });
    try {
      if (d) {
        localStorage.setItem("installDir", d);
      } else {
        localStorage.removeItem("installDir");
      }
    } catch {}
  },
  installDirError: null,
  setInstallDirError: (s) => set({ installDirError: s }),

  comfyuiDir: "",
  setComfyuiDir: (d) => set({ comfyuiDir: d }),
  pythonExe: "",
  setPythonExe: (d) => set({ pythonExe: d }),

  configPort: 8188,
  setConfigPort: (p) => set({ configPort: p }),
  launchArgs: "",
  setLaunchArgs: (a) => set({ launchArgs: a }),
  loadInstallConfig: async () => {
    const { installDir } = get();
    if (!installDir || !isTauri()) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const cfg: any = await invoke("read_install_config", { installDir });
      if (cfg) {
        set({
          comfyuiDir: cfg.comfyui_dir ?? "",
          pythonExe: cfg.python_exe ?? "",
          configPort: cfg.port ?? 8188,
          launchArgs: cfg.launch_args ?? "",
        });
      }
    } catch (e: any) {
      get().appendLog(tr("store.log.configReadFailed", { msg: e?.toString?.() ?? String(e) }));
    }
  },
  saveInstallConfig: async (port, launchArgs) => {
    const { installDir } = get();
    if (!installDir) return tr("store.noInstallDir");
    if (!isTauri()) return tr("store.previewNoConfig");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("update_install_config", { installDir, port, launchArgs });
      set({ configPort: port, launchArgs });
      get().appendLog(tr("store.log.configSaved", { port }));
      return null;
    } catch (e: any) {
      const msg = e?.toString?.() ?? String(e);
      get().appendLog(tr("store.log.configSaveFailed", { msg }));
      return msg;
    }
  },

  steps: HOST_STEPS.map((s) => ({ ...s })),
  running: false,
  error: null,
  overallPercent: 0,

  rebuildStepsForMode: () => {
    const m = get().installMode;
    const base = m === "host" ? HOST_STEPS : DOCKER_STEPS;
    set({ steps: base.map((s) => ({ ...s })), overallPercent: 0 });
  },

  setStepRunning: (key) =>
    set((s) => {
      const steps = s.steps.map((x) =>
        x.key === key ? { ...x, status: "running" as const } : x
      );
      return { steps };
    }),
  setStepProgress: (key, progress) =>
    set((s) => {
      const steps = s.steps.map((x) =>
        x.key === key ? { ...x, progress: Math.min(100, progress) } : x
      );
      const total =
        steps.reduce((acc, x) => acc + x.progress, 0) / Math.max(1, steps.length);
      return { steps, overallPercent: Math.round(total) };
    }),
  setStepSuccess: (key) =>
    set((s) => {
      const steps = s.steps.map((x) =>
        x.key === key ? { ...x, status: "success" as const, progress: 100 } : x
      );
      const total =
        steps.reduce((acc, x) => acc + x.progress, 0) / Math.max(1, steps.length);
      return { steps, overallPercent: Math.round(total) };
    }),
  setStepError: (key, msg) =>
    set((s) => {
      const steps = s.steps.map((x) =>
        x.key === key ? { ...x, status: "error" as const } : x
      );
      return { steps, error: msg, running: false };
    }),

  setRunning: (b) => set({ running: b }),
  setError: (e) => set({ error: e }),

  service: {
    status: "unknown",
    url: "",
    port: 0,
  },
  setServiceStatus: (patch) =>
    set((s) => ({ service: { ...s.service, ...patch } })),
  serviceBusy: false,
  setServiceBusy: (b) => set({ serviceBusy: b }),
  refreshService: async () => {
    if (!isTauri()) {
      const errMsg = tr("store.previewService");
      set({
        service: {
          status: "error",
          url: "",
          port: 0,
          last_error: errMsg,
        },
      });
      get().appendLog(`[warn] ${errMsg}`);
      return;
    }
    try {
      const mod = await import("@tauri-apps/api/core");
      const currInstallDir = get().installDir;
      const currInstallMode = get().installMode;
      const prevService = get().service;
      const res: any = await mod.invoke("get_service_status", {
        installDir: currInstallDir,
        installMode: currInstallMode,
      });
      const nextStatus: ServiceStatus = res?.status ?? "unknown";
      const nextLastError =
        res?.last_error ??
        (nextStatus === "running" || nextStatus === "starting"
          ? undefined
          : prevService.last_error);
      set({
        service: {
          status: nextStatus,
          url: res?.url ?? "",
          port: res?.port ?? 0,
          pid: res?.pid ?? undefined,
          started_at: res?.started_at ?? undefined,
          last_error: nextLastError,
        },
      });
    } catch (e: any) {
      set({
        service: { ...get().service, status: "error", last_error: typeof e === "string" ? e : e?.toString?.() ?? tr("store.unknownError") },
      });
    }
  },

  envCheckItems: [],
  envCheckSummary: null,
  envCheckRunning: false,
  envCheckError: null,
  setEnvCheckItems: (items) => set({ envCheckItems: items }),
  setEnvCheckSummary: (s) => set({ envCheckSummary: s }),
  setEnvCheckRunning: (b) => set({ envCheckRunning: b }),
  setEnvCheckError: (e) => set({ envCheckError: e }),
  runEnvCheck: async () => {
    const { installDir, installMode } = get();
    set({ envCheckRunning: true, envCheckItems: [], envCheckError: null });
    if (!isTauri()) {
      const msg = tr("store.previewEnv");
      set({ envCheckRunning: false, envCheckError: msg });
      get().appendLog(`[env-check] ${msg}`);
      return;
    }
    try {
      const mod = await import("@tauri-apps/api/core");
      const res: any = await mod.invoke("detect_environment", {
        installDir,
        installMode,
      });
      set({
        envCheckItems: res?.items ?? [],
        envCheckSummary: res?.summary ?? null,
        envCheckError: null,
      });
      // 检测到 ComfyUI 本体缺失（main.py 不存在）→ 视为未安装，直接跳回安装页，不再停留「修复」
      const missingBody = (res?.items ?? []).some(
        (i: any) => i?.key === "comfyui" && i?.status === "error"
      );
      if (missingBody) {
        get().appendLog(tr("store.log.envMissingBody"));
        get().resetInstallState();
        get().go("welcome");
        return;
      }
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.detectFailed");
      set({ envCheckError: msg });
      get().appendLog(tr("store.log.envCheckFailed", { msg }));
    } finally {
      set({ envCheckRunning: false });
    }
  },

  models: [],
  modelCategories: [],
  modelsTotal: 0,
  nodes: [],
  workflows: [],
  resourcesScanning: false,
  runScanResources: async () => {
    const { installDir } = get();
    if (!installDir) return;
    set({ resourcesScanning: true });
    if (!isTauri()) {
      set({ resourcesScanning: false });
      return;
    }
    try {
      const mod = await import("@tauri-apps/api/core");
      const [modelsRes, nodesRes, workflowsRes]: any[] = await Promise.all([
        mod.invoke("scan_models", { installDir }),
        mod.invoke("scan_nodes", { installDir }),
        mod.invoke("scan_workflows", { installDir }),
      ]);
      set({
        models: modelsRes?.models ?? [],
        modelCategories: modelsRes?.categories ?? [],
        modelsTotal: modelsRes?.total ?? 0,
        nodes: nodesRes ?? [],
        workflows: workflowsRes ?? [],
      });
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.scanFailed");
      get().appendLog(tr("store.log.resourcesScanFailed", { msg }));
    } finally {
      set({ resourcesScanning: false });
    }
  },

  blueprints: [],
  blueprintsScanning: false,
  scanBlueprints: async () => {
    const { installDir } = get();
    if (!installDir || !isTauri()) return;
    set({ blueprintsScanning: true });
    try {
      const mod = await import("@tauri-apps/api/core");
      const res: any = await mod.invoke("scan_blueprints", { installDir });
      set({ blueprints: res ?? [] });
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.scanFailed");
      get().appendLog(tr("store.log.blueprintsScanFailed", { msg }));
    } finally {
      set({ blueprintsScanning: false });
    }
  },

  diagnosis: null,
  diagnosisLoading: false,
  diagnosisError: null,
  analyzeWorkflow: async (fileName) => {
    const { installDir } = get();
    if (!installDir || !isTauri()) {
      set({ diagnosisError: tr("store.previewDiagnosis") });
      return;
    }
    set({ diagnosisLoading: true, diagnosisError: null, diagnosis: null });
    try {
      const mod = await import("@tauri-apps/api/core");
      const res: any = await mod.invoke("analyze_workflow", { installDir, fileName });
      set({ diagnosis: res ?? null });
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.scanFailed");
      set({ diagnosisError: msg });
      get().appendLog(tr("store.log.analyzeFailed", { msg }));
    } finally {
      set({ diagnosisLoading: false });
    }
  },

  modelDownloads: {},
  downloadModel: async (category, fileName, url) => {
    const { installDir, modelDownloads } = get();
    if (modelDownloads[fileName]?.status === "downloading") return;
    if (!installDir) {
      get().appendLog(tr("store.log.modelNoDir"));
      return;
    }
    if (!isTauri()) {
      set((s) => ({
        modelDownloads: {
          ...s.modelDownloads,
          [fileName]: { downloaded: 0, total: 0, status: "error", error: tr("store.previewNoDownload") },
        },
      }));
      get().appendLog(tr("store.log.modelPreview"));
      return;
    }
    set((s) => ({
      modelDownloads: {
        ...s.modelDownloads,
        [fileName]: { downloaded: 0, total: 0, status: "downloading" },
      },
    }));
    get().appendLog(tr("store.log.modelStart", { name: fileName }));
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("download_model", { installDir, category, fileName, url });
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.downloadFailed");
      set((s) => ({
        modelDownloads: {
          ...s.modelDownloads,
          [fileName]: { downloaded: 0, total: 0, status: "error", error: msg },
        },
      }));
      get().appendLog(tr("store.log.modelDownloadFailed", { name: fileName, msg }));
    }
  },
  deleteModel: async (category, fileName) => {
    const { installDir } = get();
    if (!installDir || !isTauri()) {
      get().appendLog(tr("store.log.modelPreviewDelete"));
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_model", { installDir, category, fileName });
      get().appendLog(tr("store.log.modelDeleted", { name: fileName }));
      await get().runScanResources();
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.deleteFailed");
      get().appendLog(tr("store.log.modelDeleteFailed", { name: fileName, msg }));
      throw new Error(msg);
    }
  },
  deleteNode: async (nodeName) => {
    const { installDir } = get();
    if (!installDir || !isTauri()) {
      get().appendLog(tr("store.log.nodePreviewDelete"));
      throw new Error(tr("store.previewNoDeleteNode"));
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_node", { installDir, nodeName });
      get().appendLog(tr("store.log.nodeDeleted", { name: nodeName }));
      await get().runScanResources();
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.deleteFailed");
      get().appendLog(tr("store.log.nodeDeleteFailed", { name: nodeName, msg }));
      throw new Error(msg);
    }
  },
  installTranslateNode: async () => {
    const { installDir } = get();
    if (!installDir || !isTauri()) {
      get().appendLog(tr("store.log.nodePreviewTranslate"));
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      get().appendLog(tr("store.log.nodeTranslateInstalling"));
      const r: string = await invoke("install_translate_node", { installDir });
      get().appendLog(`[node] ${r}`);
      await get().runScanResources();
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? tr("store.installFailed");
      get().appendLog(tr("store.log.nodeTranslateFailed", { msg }));
    }
  },
  setModelDownloadProgress: (fileName, downloaded, total) =>
    set((s) => ({
      modelDownloads: {
        ...s.modelDownloads,
        [fileName]: { downloaded, total, status: "downloading" },
      },
    })),
  setModelDownloadDone: (fileName, ok, error) => {
    set((s) => ({
      modelDownloads: {
        ...s.modelDownloads,
        [fileName]: {
          downloaded: s.modelDownloads[fileName]?.downloaded ?? 0,
          total: s.modelDownloads[fileName]?.total ?? 0,
          status: ok ? "done" : "error",
          error: ok ? undefined : error || tr("store.downloadFailed"),
        },
      },
    }));
    get().appendLog(
      ok
        ? tr("store.log.modelDone", { name: fileName })
        : tr("store.log.modelDoneFailed", { name: fileName, msg: error || tr("store.unknownError") })
    );
    if (ok) {
      void get().runScanResources();
    }
  },

  logs: [],
  appendLog: (line) =>
    set((s) => {
      const last = s.logs[s.logs.length - 1];
      if (last === line) return {};
      return {
        logs: [...s.logs.slice(-1000), line],
      };
    }),
  clearLogs: () => set({ logs: [] }),
  logsOpen: false,
  setLogsOpen: (b) => set({ logsOpen: b }),

  resetInstall: () => {
    const base = get().installMode === "host" ? HOST_STEPS : DOCKER_STEPS;
    set({
      steps: base.map((s) => ({ ...s })),
      overallPercent: 0,
      error: null,
      running: false,
    });
  },

  resetInstallState: () => {
    get().setInstallDir("");
    get().setComfyuiDir("");
    get().setPythonExe("");
    get().setServiceStatus({
      status: "stopped",
      url: "",
      port: 0,
      pid: undefined,
      started_at: undefined,
      last_error: undefined,
    });
  },
}));
