import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useInstallerStore } from "./store/installerStore";
import { useBootstrap } from "./hooks/useBootstrap";
import { useUpdater } from "./hooks/useUpdater";
import { ensureEnvCheckListenOnce, ensureInstallLogListenOnce, ensureModelDownloadListenOnce } from "./lib/boot";
import { initRemoteContent } from "./lib/initRemote";
import { onDragRegionMouseDown } from "./lib/window";
import { TitleBar } from "./components/TitleBar";
import { useT } from "./lib/i18n";
import { ContactModal } from "./components/ContactModal";
import Welcome from "./pages/Welcome";
import Detect from "./pages/Detect";
import Install from "./pages/Install";
import Complete from "./pages/Complete";
import Manage from "./pages/Manage";
import Settings from "./pages/Settings";

function readInitialDark(): boolean {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light") return false;
    if (saved === "dark") return true;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    )
      return true;
    return true;
  } catch {
    return true;
  }
}

function App() {
  const page = useInstallerStore((s) => s.page);
  const appVersion = useInstallerStore((s) => s.appVersion);

  const { envIsTauri, bootstrapping, bootstrapMsg } = useBootstrap();

  const t = useT();
  const { update, downloading, installed, downloadAndInstall } = useUpdater();

  const [dark, setDark] = useState<boolean>(readInitialDark);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById("root");
    if (dark) {
      root.classList.add("dark");
      body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
    }
    if (envIsTauri) {
      root.classList.add("tauri-window");
      body.classList.add("tauri-window");
      appRoot?.classList.add("tauri-window");
      root.style.backgroundColor = "transparent";
      body.style.backgroundColor = "transparent";
    } else if (dark) {
      root.classList.remove("tauri-window");
      body.classList.remove("tauri-window");
      appRoot?.classList.remove("tauri-window");
      root.style.backgroundColor = "#0b1220";
      body.style.backgroundColor = "#0b1220";
    } else {
      root.classList.remove("tauri-window");
      body.classList.remove("tauri-window");
      appRoot?.classList.remove("tauri-window");
      root.style.backgroundColor = "#f8fafc";
      body.style.backgroundColor = "#f8fafc";
    }
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }, [dark, envIsTauri]);

  useEffect(() => {
    ensureInstallLogListenOnce();
    ensureEnvCheckListenOnce();
    ensureModelDownloadListenOnce();
    void initRemoteContent();
  }, []);

  // 截图/预览便利：URL 带 #welcome / #detect / #install / #complete / #settings / #manage 可直达对应页面。
  // 正常启动（不带 hash）不影响原有流程。
  useEffect(() => {
    if (bootstrapping) return;
    const VALID = ["welcome", "detect", "install", "complete", "settings", "manage"];
    const applyHash = () => {
      const h = window.location.hash.replace("#", "").toLowerCase();
      if (VALID.includes(h)) useInstallerStore.getState().go(h as any);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [bootstrapping]);

  useEffect(() => {
    const root = document.documentElement;
    const nowDark = root.classList.contains("dark");
    if (nowDark !== dark) setDark(nowDark);

    const onGlobal = (e: any) => {
      const detail = (e as CustomEvent).detail as { dark: boolean };
      setDark(!!detail.dark);
    };
    window.addEventListener("theme-changed", onGlobal as any);
    return () => window.removeEventListener("theme-changed", onGlobal as any);
  }, [dark]);

  const toggleTheme = () => {
    const win = window as any;
    if (typeof win.__toggleTheme === "function") {
      win.__toggleTheme();
      return;
    }
    const root = document.documentElement;
    const body = document.body;
    const nowDark = !root.classList.contains("dark");
    try {
      localStorage.setItem("theme", nowDark ? "dark" : "light");
    } catch {}
    if (nowDark) {
      root.classList.add("dark");
      body.classList.add("dark");
      root.style.backgroundColor = "#0b1220";
      body.style.backgroundColor = "#0b1220";
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
      root.style.backgroundColor = "#f8fafc";
      body.style.backgroundColor = "#f8fafc";
    }
    try {
      window.dispatchEvent(new CustomEvent("theme-changed", { detail: { dark: nowDark } }));
    } catch {}
    setDark(nowDark);
  };

  const showManage = page === "manage";

  return (
    <div className={`min-h-screen h-screen w-full ${envIsTauri ? "bg-transparent overflow-hidden rounded-[10px]" : ""}`}>
      <div className={`h-full w-full flex flex-col dark:text-slate-100 text-slate-900 overflow-hidden relative bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-[#0b1220] from-slate-50 via-white to-slate-100 ${
        envIsTauri ? "rounded-[10px] shadow-none" : ""
      }`}>
      {bootstrapping && (
        <div
          className="absolute inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-[#0b1220] from-slate-50 via-white to-slate-100"
          onMouseDown={onDragRegionMouseDown}
        >
          <div className="flex flex-col items-center gap-4 px-8 text-center">
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500/30 via-indigo-500/30 to-purple-500/30 dark:ring-2 ring-white/10 dark:border-white/10 border-slate-300 ring-1 flex items-center justify-center overflow-hidden shadow-xl">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-[85%] h-[85%] object-contain drop-shadow-[0_0_14px_rgba(99,102,241,0.5)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xl font-bold tracking-wide">{t("app.name")}</div>
            <div className="text-xs dark:text-slate-400 text-slate-600 font-medium max-w-sm leading-relaxed break-all">
              {bootstrapMsg}
            </div>
          </div>
          <div className="inline-flex items-center gap-3 rounded-full px-5 py-2 border dark:border-slate-700 border-slate-200 dark:bg-slate-900/60 bg-white shadow-lg shadow-slate-500/10">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            <span className="text-sm font-semibold dark:text-slate-300 text-slate-700">
              {t("app.loading")}
            </span>
          </div>
        </div>
        </div>
      )}
      <div
        className="flex flex-col flex-1 min-h-0 w-full relative px-3 pt-3 pb-3 h-full"
      >
        {showManage && (
          <div
            className="absolute top-0 left-0 right-0 h-11 z-40"
            onMouseDown={onDragRegionMouseDown}
          />
        )}
        <TitleBar
          showManage={showManage}
          dark={dark}
          envIsTauri={envIsTauri}
          onToggleTheme={toggleTheme}
        />

        <main className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden pr-1">
          {!bootstrapping && (
            <>
              {page === "welcome" && <Welcome />}
              {page === "detect" && <Detect />}
              {page === "install" && <Install />}
              {page === "complete" && <Complete />}
              {page === "settings" && <Settings />}
              {page === "manage" && <Manage />}
            </>
          )}
        </main>

        {!showManage && (
          <div className="mt-5 flex items-center justify-between text-[10.5px] dark:text-slate-500 text-slate-700 select-none border-t dark:border-slate-800 border-slate-200 pt-3 flex-shrink-0">
            <button
              onClick={() => setContactOpen(true)}
              className="inline-flex items-center gap-1.5 hover:underline underline-offset-2"
              title={t("sidebar.contact")}
            >
              <span className="font-semibold">{t("sidebar.contact")}</span>
              <span className="dark:text-slate-600 text-slate-400">·</span>
              <span>{t("sidebar.contact.channels")}</span>
            </button>
            <div className="inline-flex items-center gap-2 font-mono">
              <span className="font-semibold">v{appVersion || "0.1.0"}</span>
              <span className="dark:text-slate-600 text-slate-400">·</span>
              <span>20260813</span>

              {installed ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t("update.installed")}</span>
              ) : update ? (
                <>
                  <span className="text-amber-500 font-semibold">{t("update.available", { version: update.version })}</span>
                  <button
                    onClick={() => void downloadAndInstall()}
                    disabled={downloading}
                    className="inline-flex items-center rounded-full bg-brand-500 hover:bg-brand-400 text-white px-2.5 py-0.5 text-[10.5px] font-bold transition disabled:opacity-60"
                  >
                    {downloading ? t("update.downloading") : t("update.download")}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}

export default App;
