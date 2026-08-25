import { useState } from "react";
import { Megaphone, Minus, Moon, Square, Sun, User, X } from "lucide-react";
import { closeWindow, minimizeWindow, onDragRegionMouseDown, toggleMaximizeWindow } from "../lib/window";
import { useT, useI18n } from "../lib/i18n";
import { useInstallerStore } from "../store/installerStore";

interface TitleBarProps {
  showManage: boolean;
  dark: boolean;
  envIsTauri: boolean;
  onToggleTheme: () => void;
}

export function TitleBar({
  showManage,
  dark,
  envIsTauri,
  onToggleTheme,
}: TitleBarProps) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const [loginOpen, setLoginOpen] = useState(false);

  const announcement = useInstallerStore((s) => s.manifestContent?.announcements?.[0] ?? null);

  const announcementLevelCls: Record<string, string> = {
    info: "text-sky-600 dark:text-sky-300",
    warn: "text-amber-600 dark:text-amber-300",
    error: "text-rose-600 dark:text-rose-300",
  };

  const announcementBar = announcement ? (
    <div
      title={announcement.body ?? announcement.title}
      className={`inline-flex items-center gap-2 w-[440px] max-w-[58vw] ${announcementLevelCls[announcement.level] ?? announcementLevelCls.info}`}
    >
      <Megaphone className="w-5 h-5 flex-shrink-0" />
      <div className="relative flex-1 overflow-hidden">
        <div className="announcement-marquee flex items-center whitespace-nowrap">
          <span className="mx-4 text-lg font-semibold leading-none">{announcement.title}</span>
          <span className="mx-4 text-lg font-semibold leading-none">{announcement.title}</span>
        </div>
      </div>
    </div>
  ) : null;

  const controls = (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={() => setLoginOpen(true)}
        title={t("titlebar.login")}
        className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg border transition dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 bg-white/70 dark:bg-slate-800/40 text-[11px] font-semibold leading-none"
      >
        <User className="w-4 h-4" />
        <span>{t("titlebar.login")}</span>
      </button>
      <button
        id="__THEME_BTN__"
        onClick={onToggleTheme}
        title={dark ? t("titlebar.toLight") : t("titlebar.toDark")}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border transition dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 bg-white/70 dark:bg-slate-800/40"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <button
        onClick={() => setLang(lang === "zh" ? "en" : "zh")}
        title={t("common.language")}
        aria-label={t("common.language")}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border transition dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 bg-white/70 dark:bg-slate-800/40 text-[11px] font-bold leading-none"
      >
        {lang === "zh" ? "EN" : "中"}
      </button>
      {envIsTauri && (
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={minimizeWindow}
            title={t("titlebar.minimize")}
            aria-label={t("titlebar.minimize")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 bg-white/70 dark:bg-slate-800/40 transition"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={toggleMaximizeWindow}
            title={t("titlebar.maximize")}
            aria-label={t("titlebar.maximize")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 bg-white/70 dark:bg-slate-800/40 transition"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={closeWindow}
            title={t("titlebar.close")}
            aria-label={t("titlebar.close")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-rose-400/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  const loginModal = loginOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={() => setLoginOpen(false)}
    >
      <div
        className="w-[360px] max-w-[90vw] rounded-2xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-[14px] font-semibold dark:text-slate-100 text-slate-900">
            {t("titlebar.login")}
          </div>
          <button
            onClick={() => setLoginOpen(false)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg dark:text-slate-400 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[13px] dark:text-slate-400 text-slate-500 text-center py-8">
          {t("auth.placeholder")}
        </div>
      </div>
    </div>
  ) : null;

  if (showManage) {
    return (
      <>
        <div className="absolute top-[27px] right-2 z-50">{controls}</div>
        {announcementBar && (
          <div className="absolute top-[27px] left-1/2 -translate-x-1/2 z-50 h-9 flex items-center">
            {announcementBar}
          </div>
        )}
        {loginModal}
      </>
    );
  }

  return (
    <>
      <header className="relative mb-4 flex items-center justify-between gap-3 flex-shrink-0">
        <div
          className="flex items-center gap-3 min-w-0 flex-1 self-stretch"
          onMouseDown={onDragRegionMouseDown}
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 via-indigo-500/30 to-purple-500/30 dark:ring-1 ring-white/10 dark:border-white/10 border-slate-300 ring-1 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-[90%] h-[90%] object-contain drop-shadow-[0_0_10px_rgba(99,102,241,0.45)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[15.5px] font-semibold tracking-wide">
              {t("app.name")}
            </div>
            <div className="text-[10.5px] dark:text-slate-400 text-slate-700 font-medium truncate">
              {t("app.tagline")}
            </div>
          </div>
        </div>

        {announcementBar && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{announcementBar}</div>
        )}

        {controls}
      </header>
      {loginModal}
    </>
  );
}
