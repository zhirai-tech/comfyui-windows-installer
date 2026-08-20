import { AlertTriangle, HardDrive, Trash2, X } from "lucide-react";
import { useT } from "../lib/i18n";

interface UninstallModalProps {
  installDir: string;
  onClose: () => void;
  onConfirm: (keepModels: boolean) => void;
}

export function UninstallModal({ installDir, onClose, onConfirm }: UninstallModalProps) {
  const t = useT();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 dark:bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-slate-800 border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-bold dark:text-slate-100 text-slate-900">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
            {t("uninstall.title")}
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-500/10 transition dark:text-slate-400 text-slate-600"
            title={t("common.close")}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="text-[12px] leading-relaxed dark:text-slate-300 text-slate-600">
            {t("uninstall.question")}
          </div>
          <div className="font-mono text-[11px] dark:text-slate-500 text-slate-500 break-all select-text">
            {installDir}
          </div>

          <button
            onClick={() => onConfirm(true)}
            className="w-full flex items-center gap-3 rounded-xl border dark:border-slate-600 border-slate-300 dark:bg-slate-800/60 bg-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-3 text-left transition"
          >
            <HardDrive className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold dark:text-slate-100 text-slate-800">
                {t("uninstall.keepModels")}
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed dark:text-slate-400 text-slate-600">
                {t("uninstall.keepModelsDesc", { dir: installDir })}
              </div>
            </div>
          </button>

          <button
            onClick={() => onConfirm(false)}
            className="w-full flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 px-3.5 py-3 text-left transition"
          >
            <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-rose-700 dark:text-rose-300">
                {t("uninstall.all")}
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-rose-600/80 dark:text-rose-300/70">
                {t("uninstall.allDesc")}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
