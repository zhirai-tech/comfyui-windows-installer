import { ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { useInstallerStore } from "../store/installerStore";
import { useT } from "../lib/i18n";

interface Props {
  /* true=左右并排布局时（占右列）：强制展开，隐藏折叠头，高度撑满父容器，内部滚动 */
  sideBySide?: boolean;
}

function LogViewer({ sideBySide = false }: Props) {
  const t = useT();
  const logs = useInstallerStore((s) => s.logs);
  const open = useInstallerStore((s) => s.logsOpen);
  const setOpen = useInstallerStore((s) => s.setLogsOpen);
  const clearLogs = useInstallerStore((s) => s.clearLogs);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [logs, open, sideBySide]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
    } catch {}
  };

  const show = sideBySide ? true : open;

  /* 左右并排布局：整个容器 flex-col 撑满父高度，头简化只占一行，体 flex-1 min-h-0 内部滚动 */
  if (sideBySide) {
    return (
      <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/90 overflow-hidden h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b dark:border-slate-800 border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-bold dark:text-slate-200 text-slate-800 truncate">
              {t("log.title")}
            </span>
            <span className="text-[10.5px] dark:text-slate-500 text-slate-600 font-semibold flex-shrink-0">
              ({t("log.entries", { count: logs.length })})
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={copy}
              className="p-1.5 rounded-lg dark:hover:bg-slate-700/60 hover:bg-slate-200 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
              title={t("log.copy")}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={clearLogs}
              className="p-1.5 rounded-lg dark:hover:bg-slate-700/60 hover:bg-slate-200 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
              title={t("log.clear")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div
          ref={ref}
          className="log-box flex-1 min-h-0 overflow-auto px-4 py-2.5 dark:bg-black/40 bg-slate-950/95 text-slate-300"
        >
          {logs.length === 0 ? (
            <div className="dark:text-slate-500 text-slate-500 italic py-4 text-center text-[12px]">
              {t("log.waiting")}
            </div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-all text-[12.5px] leading-relaxed">
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  /* 传统上下布局（兼容其他页面调用）：保留可折叠 */
  return (
    <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/90 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm dark:text-slate-300 text-slate-800 dark:hover:text-white hover:text-slate-900 dark:hover:bg-slate-800/40 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {open ? t("log.collapse") : t("log.view")}
            {t("log.detail")}
          </span>
          <span className="text-xs dark:text-slate-500 text-slate-600">
            ({t("log.entries", { count: logs.length })})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copy();
                }}
                className="p-1.5 rounded-lg dark:hover:bg-slate-700/60 hover:bg-slate-200 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
                title={t("log.copy")}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearLogs();
                }}
                className="p-1.5 rounded-lg dark:hover:bg-slate-700/60 hover:bg-slate-200 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
                title={t("log.clear")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {open && (
        <div
          ref={ref}
          className="log-box max-h-64 overflow-auto px-5 py-3 dark:bg-black/40 bg-slate-950/95 text-slate-300 border-t dark:border-slate-800 border-slate-300"
        >
          {logs.length === 0 ? (
            <div className="dark:text-slate-500 text-slate-500 italic">{t("log.empty")}</div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {l}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default memo(LogViewer);
