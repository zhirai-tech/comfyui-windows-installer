import type { ManifestContent } from "../lib/manifest";

export type Page =
  | "welcome"
  | "detect"
  | "install"
  | "complete"
  | "settings"
  | "manage";

export type InstallMode = "host" | "docker" | "desktop";
export type ComfyuiVersionMode = "latest" | "custom";

/** 启动检测到的 ComfyUI 版本类型（区别于用户主动选择的安装方式 installMode） */
export type DetectedKind = "none" | "managed" | "desktop" | "portable" | "docker";

export type ServiceStatus =
  | "unknown"
  | "stopped"
  | "starting"
  | "restarting"
  | "running"
  | "stopping"
  | "error";

export type InstallStep =
  | "idle"
  | "python"
  | "comfyui"
  | "venv"
  | "pytorch"
  | "deps"
  | "docker_check"
  | "data"
  | "docker_pull"
  | "docker_compose"
  | "compose"
  | "config"
  | "done";

export interface SystemInfo {
  os_name: string;
  os_version: string;
  os_arch: string;
  cpu_name: string;
  cpu_cores: number;
  cpu_usage_percent: number;
  ram_total_gb: number;
  ram_available_gb: number;
  ram_total_mb: number;
  ram_available_mb: number;
  disk_name: string;
  disk_total_mb: number;
  disk_available_mb: number;
  hostname: string;
}

export interface GpuRecommendation {
  sd_15: boolean;
  sdxl: boolean;
  sdxl_highres: boolean;
  video_light: boolean;
  video_heavy: boolean;
  flux: boolean;
}

export interface GpuInfo {
  has_nvidia: boolean;
  gpu_name: string;
  vram_gb: number;
  vram_total_mb: number;
  vram_used_mb: number;
  gpu_util_percent: number;
  driver_version: string;
  cuda_version: string;
  driver_is_latest?: boolean;
  recommendation: GpuRecommendation;
}

export interface PythonInfo {
  found: boolean;
  executable: string;
  version: string;
  is_compatible: boolean;
  pip_ok?: boolean;
  git_ok?: boolean;
  node_ok?: boolean;
  virtualenv_ok?: boolean;
  visual_cpp_ok?: boolean;
}

export interface DockerInfo {
  installed: boolean;
  running: boolean;
  version: string;
  compose_version: string;
  missing_requirements: string[];
  wsl2_enabled?: boolean;
  nvidia_container_ok?: boolean;
}

export interface StepState {
  key: InstallStep;
  label: string;
  status: "pending" | "running" | "success" | "error";
  progress: number;
}

export interface ServiceRuntimeInfo {
  status: ServiceStatus;
  url: string;
  port: number;
  pid?: number;
  started_at?: string;
  last_error?: string;
}

export type CheckStatus = "normal" | "warning" | "error";

export interface CheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  message: string;
  detail?: string;
}

export interface ReportSummary {
  normal: number;
  warning: number;
  error: number;
}

export interface EnvironmentReport {
  install_dir: string;
  install_mode: string;
  items: CheckItem[];
  summary: ReportSummary;
}

export interface RepairStep {
  index: number;
  total: number;
  key: string;
  label: string;
  status: string;
  message: string;
}

export interface RepairReport {
  steps: RepairStep[];
  fixed: number;
  failed: number;
}

export interface ModelFile {
  name: string;
  category: string;
  dir: string;
  size_bytes: number;
  path: string;
}

export type ModelDownloadStatus = "downloading" | "done" | "error";

export interface ModelDownloadState {
  downloaded: number;
  total: number;
  status: ModelDownloadStatus;
  error?: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface NodeInfo {
  name: string;
  path: string;
  disabled: boolean;
}

export interface WorkflowFile {
  name: string;
  path: string;
  size_bytes: number;
}

export interface BlueprintModel {
  name: string;
  url: string;
  directory: string;
}

export interface BlueprintInfo {
  file: string;
  title: string;
  category: string;
  node_types: string[];
  models: BlueprintModel[];
  thumbnail?: string | null;
  download_url?: string | null;
}

export interface WorkflowAnalysis {
  file_name: string;
  node_types: string[];
  missing_nodes: string[];
  api_node_types: string[];
  model_refs: string[];
  missing_models: string[];
  input_refs: string[];
  missing_inputs: string[];
}

export interface InstallerStore {
  page: Page;
  go: (p: Page) => void;

  /** 本地执行器是否在线（/api/health 可达）。纯 Web 下默认 false，需按需探测。 */
  executorOnline: boolean;
  executorChecked: boolean;
  checkExecutor: () => Promise<boolean>;

  installMode: InstallMode;
  setInstallMode: (m: InstallMode) => void;

  detectedKind: DetectedKind;
  setDetectedKind: (k: DetectedKind) => void;

  comfyuiVersionMode: ComfyuiVersionMode;
  comfyuiVersionRef: string;
  setComfyuiVersionSelection: (mode: ComfyuiVersionMode, ref: string) => void;

  versionsConfig: any;
  setVersionsConfig: (v: any) => void;

  manifestContent: ManifestContent | null;
  setManifestContent: (m: ManifestContent | null) => void;
  appVersion: string;
  setAppVersion: (v: string) => void;
  updateInfo: { latestVersion: string; downloadUrl: string } | null;
  setUpdateInfo: (u: { latestVersion: string; downloadUrl: string } | null) => void;

  systemInfo: SystemInfo | null;
  setSystemInfo: (s: SystemInfo) => void;

  gpuInfo: GpuInfo | null;
  setGpuInfo: (g: GpuInfo) => void;

  pythonInfo: PythonInfo | null;
  setPythonInfo: (p: PythonInfo) => void;

  dockerInfo: DockerInfo | null;
  setDockerInfo: (d: DockerInfo) => void;

  installDir: string;
  setInstallDir: (d: string) => void;
  installDirError: string | null;
  setInstallDirError: (s: string | null) => void;

  comfyuiDir: string;
  setComfyuiDir: (d: string) => void;

  pythonExe: string;
  setPythonExe: (d: string) => void;

  configPort: number;
  setConfigPort: (p: number) => void;
  launchArgs: string;
  setLaunchArgs: (a: string) => void;
  loadInstallConfig: () => Promise<void>;
  saveInstallConfig: (port: number, launchArgs: string) => Promise<string | null>;

  steps: StepState[];
  running: boolean;
  error: string | null;
  overallPercent: number;

  rebuildStepsForMode: () => void;

  setStepRunning: (key: InstallStep) => void;
  setStepProgress: (key: InstallStep, progress: number) => void;
  setStepSuccess: (key: InstallStep) => void;
  setStepError: (key: InstallStep, msg: string) => void;

  setRunning: (b: boolean) => void;
  setError: (e: string | null) => void;

  service: ServiceRuntimeInfo;
  setServiceStatus: (s: Partial<ServiceRuntimeInfo>) => void;
  serviceBusy: boolean;
  setServiceBusy: (b: boolean) => void;
  refreshService: () => Promise<void>;

  envCheckItems: CheckItem[];
  envCheckSummary: ReportSummary | null;
  envCheckRunning: boolean;
  envCheckError: string | null;
  setEnvCheckItems: (items: CheckItem[]) => void;
  setEnvCheckSummary: (s: ReportSummary | null) => void;
  setEnvCheckRunning: (b: boolean) => void;
  setEnvCheckError: (e: string | null) => void;
  runEnvCheck: () => Promise<void>;

  models: ModelFile[];
  modelCategories: CategoryCount[];
  modelsTotal: number;
  nodes: NodeInfo[];
  workflows: WorkflowFile[];
  resourcesScanning: boolean;
  runScanResources: () => Promise<void>;

  blueprints: BlueprintInfo[];
  blueprintsScanning: boolean;
  scanBlueprints: () => Promise<void>;

  diagnosis: WorkflowAnalysis | null;
  diagnosisLoading: boolean;
  diagnosisError: string | null;
  analyzeWorkflow: (fileName: string) => Promise<void>;

  modelDownloads: Record<string, ModelDownloadState>;
  downloadModel: (category: string, fileName: string, url: string) => Promise<void>;
  deleteModel: (category: string, fileName: string) => Promise<void>;
  deleteNode: (nodeName: string) => Promise<void>;
  installTranslateNode: () => Promise<void>;
  setModelDownloadProgress: (fileName: string, downloaded: number, total: number) => void;
  setModelDownloadDone: (fileName: string, ok: boolean, error: string) => void;

  logs: string[];
  appendLog: (line: string) => void;
  clearLogs: () => void;
  logsOpen: boolean;
  setLogsOpen: (b: boolean) => void;

  resetInstall: () => void;

  /** 清空安装状态（目录/配置/服务），回到全新未安装状态，供重新安装与「检测到本体缺失」自动跳转共用 */
  resetInstallState: () => void;
}
