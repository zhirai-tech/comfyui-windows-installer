import { useEffect, useState } from "react";
import { Box, Copy, PanelLeftClose, PanelLeftOpen, ScanLine, Settings2, Terminal, Workflow, X } from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import LogViewer from "../components/LogViewer";
import { SidebarItem } from "../components/ManageSidebar";
import { ManageControls } from "../components/ManageControls";
import { EnvironmentCheck } from "../components/EnvironmentCheck";
import { ConsoleOverview } from "../components/ConsoleOverview";
import { SettingsPanel } from "../components/SettingsPanel";
import { WorkflowMarket } from "../components/WorkflowMarket";
import { ModelManager } from "../components/ModelManager";
import { ContactModal } from "../components/ContactModal";
import { UninstallModal } from "../components/UninstallModal";
import { useServiceActions } from "../hooks/useServiceActions";
import { reportDebug } from "../lib/debug";
import { onDragRegionMouseDown, openExternal } from "../lib/window";
import { useT } from "../lib/i18n";

type ManageView = "console" | "environment" | "workflows" | "models" | "settings";

export default function Manage() {
  const installDir = useInstallerStore((s) => s.installDir);
  const installMode = useInstallerStore((s) => s.installMode);
  const service = useInstallerStore((s) => s.service);
  const setServiceStatus = useInstallerStore((s) => s.setServiceStatus);
  const refreshService = useInstallerStore((s) => s.refreshService);
  const appendLog = useInstallerStore((s) => s.appendLog);
  const serviceBusy = useInstallerStore((s) => s.serviceBusy);
  const envCheckSummary = useInstallerStore((s) => s.envCheckSummary);
  const envCheckRunning = useInstallerStore((s) => s.envCheckRunning);
  const runEnvCheck = useInstallerStore((s) => s.runEnvCheck);
  const loadInstallConfig = useInstallerStore((s) => s.loadInstallConfig);
  const appVersion = useInstallerStore((s) => s.appVersion);
  const updateInfo = useInstallerStore((s) => s.updateInfo);

  const { headerBusy, start, restart, stop, uninstall, reinstall } = useServiceActions(installDir, installMode);

  const t = useT();

  const [stickyError, setStickyError] = useState("");
  const [view, setView] = useState<ManageView>("console");
  const [contactOpen, setContactOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (service.last_error && service.last_error.trim()) {
      setStickyError(service.last_error);
    }
  }, [service.last_error]);

  useEffect(() => {
    // 真轮询：每3秒真实 probe 8188/容器状态
    // #region debug-point C:manage-mount
    reportDebug("C", "Manage.tsx:mount", "manage page mounted", {
      installDir,
      installMode,
      serviceStatus: service.status,
    });
    // #endregion
    if (serviceBusy) return; // 操作进行中暂停轮询，保留启动中/停止中等过渡状态
    void refreshService();
    const id = setInterval(() => {
      void refreshService();
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceBusy]);

  useEffect(() => {
    // 进入控制台自动检测一次环境（未检测过时）+ 加载安装配置
    void loadInstallConfig();
    if (!envCheckSummary && !envCheckRunning) {
      void runEnvCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyError = async () => {
    const text = stickyError || service.last_error || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      appendLog(t("manage.log.copiedError"));
    } catch (e) {
      appendLog(t("manage.log.copyFailed", { err: String(e) }));
    }
  };

  const openUi = async () => {
    const target = service.url || "http://127.0.0.1:8188";
    try {
      const mod = await import("@tauri-apps/plugin-shell");
      await mod.open(target);
      appendLog(t("manage.log.openedBrowser", { target }));
    } catch (e: any) {
      appendLog(t("manage.log.openBrowserFailed", { err: e?.toString?.() ?? e }));
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden">
      <div className={`grid grid-cols-1 gap-3 flex-1 min-h-0 ${
        sidebarCollapsed
          ? "xl:grid-cols-[64px_minmax(0,1fr)]"
          : "xl:grid-cols-[200px_minmax(0,1fr)]"
      }`}>
        <aside className="overflow-auto flex flex-col gap-4 min-h-0 pr-0.5">
          <div className={`flex min-w-0 ${sidebarCollapsed ? "flex-col items-center gap-2" : "items-center gap-2.5"}`}>
            <div
              className="flex items-center gap-2.5 min-w-0"
              onMouseDown={onDragRegionMouseDown}
            >
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 via-indigo-500/30 to-purple-500/30 dark:ring-1 ring-white/10 dark:border-white/10 border-slate-300 ring-1 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                <img
                  src="/logo.png"
                  alt="Logo"
                  draggable={false}
                  className="w-[88%] h-[88%] object-contain drop-shadow-[0_0_10px_rgba(99,102,241,0.45)] pointer-events-none"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold tracking-wide whitespace-nowrap dark:text-slate-100 text-slate-900">
                    {t("app.name")}
                  </div>
                  <div className="mt-0.5 text-[10.5px] dark:text-slate-500 text-slate-600 truncate">
                    {installMode === "docker" ? t("app.subtitle.container") : t("app.subtitle.host")}
                    {service.pid ? ` · PID ${service.pid}` : ` · ${t("app.subtitle.controller")}`}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 flex flex-col">
            <div className={`space-y-1.5 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
              <SidebarItem collapsed={sidebarCollapsed} title={t("nav.console")} icon={<Terminal className="w-4 h-4" />} active={view === "console"} onClick={() => setView("console")} />
              <SidebarItem collapsed={sidebarCollapsed} title={t("nav.workflows")} icon={<Workflow className="w-4 h-4" />} active={view === "workflows"} onClick={() => setView("workflows")} />
              <SidebarItem collapsed={sidebarCollapsed} title={t("nav.models")} icon={<Box className="w-4 h-4" />} active={view === "models"} onClick={() => setView("models")} />
              <SidebarItem collapsed={sidebarCollapsed} title={t("nav.environment")} icon={<ScanLine className="w-4 h-4" />} active={view === "environment"} onClick={() => setView("environment")} />
              <SidebarItem collapsed={sidebarCollapsed} title={t("nav.settings")} icon={<Settings2 className="w-4 h-4" />} active={view === "settings"} onClick={() => setView("settings")} />
            </div>
          </div>

          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-900/60 bg-white text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-300 transition ${sidebarCollapsed ? "mx-auto" : ""}`}
            title={sidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {!sidebarCollapsed && (
            <div className="flex-shrink-0 border-t dark:border-slate-800 border-slate-200 pt-2.5 text-[10.5px] leading-relaxed dark:text-slate-500 text-slate-600">
              <button
                onClick={() => setContactOpen(true)}
                className="inline-flex items-center gap-1.5 hover:text-brand-500 dark:hover:text-brand-300 transition text-left"
                title={t("manage.contactTitle")}
              >
                <span className="font-semibold">{t("sidebar.contact")}</span>
                <span className="dark:text-slate-600 text-slate-400">·</span>
                <span>{t("sidebar.contact.channels")}</span>
              </button>
              <div className="mt-0.5 font-mono dark:text-slate-600 text-slate-500">v{appVersion || "0.1.0"} · 20260813</div>
              {updateInfo && (
                <button
                  onClick={() => updateInfo.downloadUrl && openExternal(updateInfo.downloadUrl)}
                  className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand-500/15 text-brand-700 dark:text-brand-200 px-2 py-0.5 font-semibold hover:bg-brand-500/25 transition"
                  title={t("manage.downloadTitle")}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  {t("manage.newVersion", { version: updateInfo.latestVersion })}
                </button>
              )}
            </div>
          )}
        </aside>

        <div className="flex flex-col gap-3 min-h-0 xl:pt-12">
          <ManageControls
            service={service}
            busy={headerBusy}
            onStart={start}
            onRestart={restart}
            onStop={stop}
            onUninstall={() => setUninstallOpen(true)}
            onReinstall={reinstall}
            onOpenUi={openUi}
          />

          {(stickyError || service.last_error) && (service.status === "error" || service.status === "stopped" || service.status === "unknown") && (
            <div className="rounded-xl border border-rose-500/40 dark:bg-rose-500/10 bg-rose-50 dark:text-rose-200 text-rose-800 px-3.5 py-3 text-left text-[11.5px] leading-relaxed whitespace-pre-wrap break-all">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="font-bold dark:text-rose-300 text-rose-700">
                  {t("manage.lastErrorTitle")}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={copyError}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-1 text-[11px] font-semibold dark:hover:bg-rose-500/10 hover:bg-rose-100"
                    title={t("manage.copyError")}
                  >
                    <Copy className="w-3.5 h-3.5" /> {t("common.copy")}
                  </button>
                  <button
                    onClick={() => {
                      setStickyError("");
                      setServiceStatus({ last_error: undefined });
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-1 text-[11px] font-semibold dark:hover:bg-rose-500/10 hover:bg-rose-100"
                    title={t("manage.closeErrorTitle")}
                  >
                    <X className="w-3.5 h-3.5" /> {t("common.close")}
                  </button>
                </div>
              </div>
              {String(stickyError || service.last_error)}
            </div>
          )}

          {!installDir && (
            <div className="rounded-xl border border-amber-500/40 dark:bg-amber-500/10 bg-amber-50 dark:text-amber-200 text-amber-800 px-3.5 py-3 text-left text-[11.5px] leading-relaxed break-all">
              {t("manage.noInstallDir")}
            </div>
          )}

          {view === "console" && (
            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[400px_minmax(0,1fr)] gap-3 min-h-0">
              <ConsoleOverview onNavigate={(v) => setView(v)} />
              <LogViewer sideBySide />
            </div>
          )}

          {view === "environment" && <EnvironmentCheck />}

          {view === "workflows" && (
            <WorkflowMarket
              serviceUrl={service.url}
              serviceRunning={service.status === "running"}
              onOpenUi={openUi}
              onRestart={restart}
            />
          )}

          {view === "models" && <ModelManager />}

          {view === "settings" && <SettingsPanel />}
        </div>
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {uninstallOpen && (
        <UninstallModal
          installDir={installDir}
          onClose={() => setUninstallOpen(false)}
          onConfirm={(keep) => {
            setUninstallOpen(false);
            void uninstall(keep);
          }}
        />
      )}
    </div>
  );
}
