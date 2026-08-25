import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Loader2,
  Puzzle,
  ScanLine,
  Workflow,
  Wrench,
  XCircle,
} from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { HardwareGauges } from "./HardwareGauges";
import { useT } from "../lib/i18n";
import { invoke } from "../lib/rpc";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/70 bg-white/95 backdrop-blur p-3">
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase dark:text-slate-400 text-slate-500 mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function NeutralBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-full border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/50 bg-white/80 text-[12px] font-semibold transition"
    >
      {children}
    </button>
  );
}

function ResourceRow({
  icon,
  label,
  count,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/30 bg-slate-50/70 px-2 py-2.5 text-center hover:border-slate-300 dark:hover:border-slate-700 transition"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium dark:text-slate-300 text-slate-700">
        <span className="text-brand-600 dark:text-brand-300">{icon}</span>
        {label}
      </span>
      <span className="text-[20px] font-bold leading-none dark:text-slate-100 text-slate-900 tabular-nums">{count}</span>
    </button>
  );
}

type NavTarget = "environment" | "workflows" | "models";

export function ConsoleOverview({
  onNavigate,
}: {
  onNavigate: (v: NavTarget) => void;
}) {
  const service = useInstallerStore((s) => s.service);
  const gpuInfo = useInstallerStore((s) => s.gpuInfo);
  const setGpuInfo = useInstallerStore((s) => s.setGpuInfo);
  const systemInfo = useInstallerStore((s) => s.systemInfo);
  const setSystemInfo = useInstallerStore((s) => s.setSystemInfo);
  const envCheckSummary = useInstallerStore((s) => s.envCheckSummary);
  const envCheckItems = useInstallerStore((s) => s.envCheckItems);
  const envCheckRunning = useInstallerStore((s) => s.envCheckRunning);
  const runEnvCheck = useInstallerStore((s) => s.runEnvCheck);
  const modelsTotal = useInstallerStore((s) => s.modelsTotal);
  const nodes = useInstallerStore((s) => s.nodes);
  const workflows = useInstallerStore((s) => s.workflows);
  const runScanResources = useInstallerStore((s) => s.runScanResources);
  const resourcesScanning = useInstallerStore((s) => s.resourcesScanning);
  const appendLog = useInstallerStore((s) => s.appendLog);
  const installDir = useInstallerStore((s) => s.installDir);
  const t = useT();

  // 首次进入控制台时，硬件信息与本地资源仍在后台加载，先显示遮罩避免界面空白/无反馈
  const [hardwareLoading, setHardwareLoading] = useState(true);

  // GPU / 系统信息为静态，进入控制台时若缺失则自动补一次；失败写入日志便于排查
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        if (!gpuInfo) {
          try {
            const g: any = await invoke("detect_gpu");
            if (g?.gpu_name || g?.has_nvidia !== undefined) setGpuInfo(g);
          } catch (e) {
            appendLog(t("console.log.gpuFailed", { msg: String(e) }));
          }
        }
        // 系统信息（含磁盘）依赖安装目录，进入控制台时始终按当前 installDir 重新检测
        try {
          const s: any = await invoke("detect_system", { installDir });
          if (s) setSystemInfo(s);
        } catch (e) {
          appendLog(t("console.log.systemFailed", { msg: String(e) }));
        }
      } catch (e) {
        appendLog(t("console.log.initFailed", { msg: String(e) }));
      } finally {
        if (!canceled) setHardwareLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = hardwareLoading || resourcesScanning;

  // 进入控制台时扫描一次本地资源（模型/节点/工作流计数）
  useEffect(() => {
    void runScanResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issues = envCheckItems.filter((it) => it.status !== "normal");
  const hasIssue = !!envCheckSummary && (envCheckSummary.error > 0 || envCheckSummary.warning > 0);
  const serviceLabel =
    service.status === "running"
      ? t("status.running")
      : service.status === "starting"
        ? t("status.starting")
        : service.status === "restarting"
          ? t("status.restarting")
          : service.status === "stopping"
            ? t("status.stopping")
            : t("status.notRunning");
  const serviceDot =
    service.status === "running"
      ? "bg-emerald-500"
      : service.status === "starting" || service.status === "restarting"
        ? "bg-amber-400 animate-pulse"
        : service.status === "stopping"
          ? "bg-rose-400 animate-pulse"
          : "bg-slate-400";

  return (
    <div className="relative flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-0.5">
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          <div className="text-[12.5px] font-semibold dark:text-slate-200 text-slate-700">
            {t("console.loading.title")}
          </div>
          <div className="flex flex-col items-center gap-1 text-[11px] dark:text-slate-400 text-slate-500">
            {hardwareLoading && <span>{t("console.loading.hardware")}</span>}
            {resourcesScanning && <span>{t("console.loading.resources")}</span>}
          </div>
        </div>
      )}
      <Card title={t("console.envTitle")}>
        {envCheckSummary ? (
          <div className="mb-2.5">
            <div className="flex items-center gap-2">
              {envCheckSummary.error > 0 ? (
                <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              ) : envCheckSummary.warning > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              )}
              <span className="text-[13px] font-semibold dark:text-slate-100 text-slate-900">
                {envCheckSummary.error > 0
                  ? t("console.currentError")
                  : envCheckSummary.warning > 0
                    ? t("console.warnings", { n: envCheckSummary.warning })
                    : t("console.normal")}
              </span>
            </div>
            <div className="mt-1.5 text-[11px] dark:text-slate-500 text-slate-600">
              {t("console.summary", {
                normal: envCheckSummary.normal,
                warning: envCheckSummary.warning,
                error: envCheckSummary.error,
              })}
            </div>
          </div>
        ) : (
          <div className="text-[12px] dark:text-slate-400 text-slate-500 mb-2.5">{t("console.notChecked")}</div>
        )}

        {hasIssue ? (
          <PrimaryBtn onClick={() => onNavigate("environment")}>
            <Wrench className="w-3.5 h-3.5" /> {t("console.detectRepair")}
          </PrimaryBtn>
        ) : (
          <PrimaryBtn onClick={runEnvCheck} disabled={envCheckRunning}>
            {envCheckRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ScanLine className="w-3.5 h-3.5" />
            )}
            {envCheckRunning ? t("console.detecting") : envCheckSummary ? t("console.redetect") : t("console.detectNow")}
          </PrimaryBtn>
        )}
      </Card>

      <Card title={t("console.comfyui")}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${serviceDot}`} />
          <span className="text-[12.5px] font-semibold dark:text-slate-100 text-slate-900">
            {serviceLabel}
          </span>
        </div>
        <div className="text-[11px] font-mono dark:text-slate-500 text-slate-600 break-all">
          {service.url || "127.0.0.1:8188"}
        </div>
        {service.pid ? (
          <div className="mt-0.5 text-[11px] dark:text-slate-500 text-slate-600">PID {service.pid}</div>
        ) : null}
      </Card>

      <Card title={t("console.hardware")}>
        <div className="grid grid-cols-4 gap-x-2">
          <HardwareGauges gpuInfo={gpuInfo} systemInfo={systemInfo} />
        </div>
      </Card>

      <Card title={t("console.resources")}>
        <div className="grid grid-cols-3 gap-2">
          <ResourceRow icon={<Box className="w-3.5 h-3.5" />} label={t("console.models")} count={modelsTotal} onClick={() => onNavigate("models")} />
          <ResourceRow icon={<Puzzle className="w-3.5 h-3.5" />} label={t("console.nodes")} count={nodes.length} onClick={() => onNavigate("models")} />
          <ResourceRow icon={<Workflow className="w-3.5 h-3.5" />} label={t("console.workflows")} count={workflows.length} onClick={() => onNavigate("workflows")} />
        </div>
      </Card>

      <Card title={t("console.todo")}>
        {issues.length === 0 ? (
          <div className="text-[12px] dark:text-slate-400 text-slate-500">{t("console.noIssues")}</div>
        ) : (
          <>
            <ul className="space-y-1.5 mb-2.5">
              {issues.map((it) => (
                <li key={it.key} className="flex items-start gap-1.5 text-[11.5px] dark:text-slate-300 text-slate-700">
                  {it.status === "error" ? (
                    <XCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="min-w-0 break-all">
                    {it.label}
                    {it.message ? `：${it.message}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <NeutralBtn onClick={() => onNavigate("environment")}>{t("console.viewIssues")}</NeutralBtn>
          </>
        )}
      </Card>
    </div>
  );
}
