import { useEffect, useState, type ReactNode } from "react";
import { Bot, Box, Copy, Database, Heart, Home, LogIn, Package, PanelLeftClose, PanelLeftOpen, Plug, Puzzle, Rocket, Search, Settings2, Sparkles, Workflow, X, Zap } from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { SidebarItem } from "../components/ManageSidebar";
import { SettingsPanel } from "../components/SettingsPanel";
import { WorkflowMarket } from "../components/WorkflowMarket";
import { ResourceMarket } from "../components/ResourceMarket";
import { ContactModal } from "../components/ContactModal";
import { UninstallModal } from "../components/UninstallModal";
import { useServiceActions } from "../hooks/useServiceActions";
import { onDragRegionMouseDown, openExternal } from "../lib/window";
import { useT } from "../lib/i18n";

type ManageView =
  | "home"
  | "featured"
  | "discover"
  | "workflows"
  | "agents"
  | "skills"
  | "models"
  | "nodes"
  | "plugins"
  | "datasets"
  | "projects"
  | "myResources"
  | "myFavorites"
  | "settings";

type NavItem = { key: ManageView; labelKey: string; icon: ReactNode };

const HOME_ITEM: NavItem = { key: "home", labelKey: "nav.home", icon: <Home className="w-4 h-4" /> };

const RESOURCE_ITEMS: NavItem[] = [
  { key: "workflows", labelKey: "nav.workflows", icon: <Workflow className="w-4 h-4" /> },
  { key: "agents", labelKey: "nav.agents", icon: <Bot className="w-4 h-4" /> },
  { key: "skills", labelKey: "nav.skills", icon: <Zap className="w-4 h-4" /> },
  { key: "models", labelKey: "nav.models", icon: <Box className="w-4 h-4" /> },
  { key: "nodes", labelKey: "nav.nodes", icon: <Puzzle className="w-4 h-4" /> },
  { key: "plugins", labelKey: "nav.plugins", icon: <Plug className="w-4 h-4" /> },
  { key: "datasets", labelKey: "nav.datasets", icon: <Database className="w-4 h-4" /> },
  { key: "projects", labelKey: "nav.projects", icon: <Rocket className="w-4 h-4" /> },
];

const BOTTOM_ITEMS: NavItem[] = [
  { key: "myResources", labelKey: "nav.myResources", icon: <Package className="w-4 h-4" /> },
  { key: "myFavorites", labelKey: "nav.myFavorites", icon: <Heart className="w-4 h-4" /> },
  { key: "settings", labelKey: "nav.settings", icon: <Settings2 className="w-4 h-4" /> },
];

function ComingSoon({ title }: { title: string }) {
  const t = useT();
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed dark:border-slate-800 border-slate-300 dark:bg-slate-900/30 bg-white/50 py-16">
      <Sparkles className="w-8 h-8 opacity-30" />
      <div className="text-base font-semibold dark:text-slate-200 text-slate-700">{title}</div>
      <div className="text-[12px] dark:text-slate-500 text-slate-500">{t("common.comingSoon")}</div>
    </div>
  );
}

function LoginRequired({ title }: { title: string }) {
  const t = useT();
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed dark:border-slate-800 border-slate-300 dark:bg-slate-900/30 bg-white/50 py-16">
      <LogIn className="w-8 h-8 opacity-30" />
      <div className="text-base font-semibold dark:text-slate-200 text-slate-700">{t("common.pleaseLogin")}</div>
      <div className="text-[12px] dark:text-slate-500 text-slate-500">{title}</div>
    </div>
  );
}

function HomeView({ onNavigate }: { onNavigate: (v: ManageView) => void }) {
  const t = useT();
  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-3 overflow-auto">
      <section className="flex flex-col gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/40 bg-white/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[14px] font-semibold dark:text-slate-100 text-slate-900">
            <Sparkles className="w-4 h-4 text-brand-500" />
            {t("nav.featured")}
          </div>
          <button
            onClick={() => onNavigate("featured")}
            className="text-[12px] font-semibold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 transition"
          >
            {t("common.viewMore")}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed dark:border-slate-800 border-slate-300 text-slate-400 text-[12px] min-h-40">
          {t("common.comingSoon")}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/40 bg-white/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[14px] font-semibold dark:text-slate-100 text-slate-900">
            <Search className="w-4 h-4 text-brand-500" />
            {t("nav.discover")}
          </div>
          <button
            onClick={() => onNavigate("discover")}
            className="text-[12px] font-semibold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 transition"
          >
            {t("common.viewMore")}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed dark:border-slate-800 border-slate-300 text-slate-400 text-[12px] min-h-40">
          {t("common.comingSoon")}
        </div>
      </section>
    </div>
  );
}

export default function Manage() {
  const installDir = useInstallerStore((s) => s.installDir);
  const installMode = useInstallerStore((s) => s.installMode);
  const service = useInstallerStore((s) => s.service);
  const setServiceStatus = useInstallerStore((s) => s.setServiceStatus);
  const appendLog = useInstallerStore((s) => s.appendLog);
  const appVersion = useInstallerStore((s) => s.appVersion);
  const updateInfo = useInstallerStore((s) => s.updateInfo);

  const { restart, uninstall } = useServiceActions(installDir, installMode);

  const t = useT();

  const [stickyError, setStickyError] = useState("");
  const [view, setView] = useState<ManageView>("workflows");
  const [contactOpen, setContactOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (service.last_error && service.last_error.trim()) {
      setStickyError(service.last_error);
    }
  }, [service.last_error]);

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
      await openExternal(target);
      appendLog(t("manage.log.openedBrowser", { target }));
    } catch (e: any) {
      appendLog(t("manage.log.openBrowserFailed", { err: e?.toString?.() ?? e }));
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden">
      {/* 页头（全宽） */}
      <header className="shrink-0 flex items-end gap-2 px-1 pb-2.5 border-b dark:border-slate-800 border-slate-200">
        <div className="flex items-center gap-3 min-w-0" onMouseDown={onDragRegionMouseDown}>
          <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500/30 via-indigo-500/30 to-purple-500/30 dark:ring-1 ring-white/10 dark:border-white/10 border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
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
          <div className="min-w-0 leading-tight">
            <div className="text-[17px] font-semibold tracking-wide whitespace-nowrap dark:text-slate-100 text-slate-900">
              {t("app.name")}
            </div>
            <div className="text-[10.5px] dark:text-slate-500 text-slate-600 truncate">
              {t("app.nameZh")}
            </div>
          </div>
        </div>

        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="shrink-0 -ml-1 mb-0.5 inline-flex items-center justify-center w-3.5 h-3.5 text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-300 transition relative z-50"
          title={sidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>

      </header>

      {/* 主体 */}
      <div className={`grid grid-cols-1 gap-3 flex-1 min-h-0 ${
        sidebarCollapsed
          ? "xl:grid-cols-[88px_minmax(0,1fr)]"
          : "xl:grid-cols-[200px_minmax(0,1fr)]"
      }`}>
        {/* 侧边栏（仅菜单） */}
        <aside className="overflow-auto min-h-0 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/40 bg-slate-50/60 p-2 flex flex-col">
          {/* 首页 */}
          <div className={`shrink-0 flex ${sidebarCollapsed ? "justify-center" : ""}`}>
            <SidebarItem
              collapsed={sidebarCollapsed}
              title={t(HOME_ITEM.labelKey)}
              icon={HOME_ITEM.icon}
              active={view === "home"}
              onClick={() => setView("home")}
            />
          </div>

          {/* 资源菜单 */}
          <nav className={`mt-1.5 space-y-1 flex-1 min-h-0 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
            {RESOURCE_ITEMS.map((item) => (
              <SidebarItem
                key={item.key}
                collapsed={sidebarCollapsed}
                title={t(item.labelKey)}
                icon={item.icon}
                active={view === item.key}
                onClick={() => setView(item.key)}
              />
            ))}
          </nav>

          {/* 底部（贴底） */}
          <div className={`shrink-0 mt-2 border-t dark:border-slate-800 border-slate-200 pt-2 space-y-1 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
            {BOTTOM_ITEMS.map((item) => (
              <SidebarItem
                key={item.key}
                collapsed={sidebarCollapsed}
                title={t(item.labelKey)}
                icon={item.icon}
                active={view === item.key}
                onClick={() => setView(item.key)}
              />
            ))}
          </div>
        </aside>

        <div className="flex flex-col gap-1.5 min-h-0">
          <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          {/* 顶部服务控制已停用：定位为网页端资源市场 */}
          {/* 纯 Web 市场模式：隐藏硬件/系统检测条（检测能力保留，接入执行器后按需恢复） */}
          {/* <HardwareBar /> */}

          {/* 运行异常错误提示条已停用（阶段0） */}
          {false && (stickyError || service.last_error) && (service.status === "error" || service.status === "stopped" || service.status === "unknown") && (
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

          {view === "home" && <HomeView onNavigate={setView} />}
          {view === "featured" && <ComingSoon title={t("nav.featured")} />}
          {view === "discover" && <ComingSoon title={t("nav.discover")} />}

          {view === "workflows" && (
            <WorkflowMarket
              serviceUrl={service.url}
              serviceRunning={service.status === "running"}
              onOpenUi={openUi}
              onRestart={restart}
            />
          )}

          {view === "agents" && <ResourceMarket type="agent" />}
          {view === "skills" && <ResourceMarket type="skill" />}
          {view === "models" && <ResourceMarket type="model" />}
          {view === "nodes" && <ResourceMarket type="node" />}
          {view === "plugins" && <ResourceMarket type="plugin" />}
          {view === "datasets" && <ResourceMarket type="dataset" />}
          {view === "projects" && <ResourceMarket type="project" />}

          {view === "myResources" && <LoginRequired title={t("nav.myResources")} />}
          {view === "myFavorites" && <LoginRequired title={t("nav.myFavorites")} />}

          {view === "settings" && <SettingsPanel />}
          </div>

          {/* 页脚（仅右侧内容区） */}
          <footer className="shrink-0 border-t dark:border-slate-800 border-slate-200 pt-2.5 flex items-center gap-3 text-[11px] dark:text-slate-500 text-slate-600">
            <button
              onClick={() => setContactOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-brand-500 dark:hover:text-brand-300 transition text-left"
              title={t("manage.contactTitle")}
            >
              <span className="font-semibold">{t("sidebar.contact")}</span>
              <span className="dark:text-slate-600 text-slate-400">·</span>
              <span>{t("sidebar.contact.channels")}</span>
            </button>
            <div className="flex-1" />
            {updateInfo && (
              <button
                onClick={() => updateInfo.downloadUrl && openExternal(updateInfo.downloadUrl)}
                className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 text-brand-700 dark:text-brand-200 px-2 py-0.5 font-semibold hover:bg-brand-500/25 transition"
                title={t("manage.downloadTitle")}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                {t("manage.newVersion", { version: updateInfo.latestVersion })}
              </button>
            )}
            <div className="font-mono dark:text-slate-600 text-slate-500">v{appVersion || "0.1.0"}</div>
          </footer>
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
