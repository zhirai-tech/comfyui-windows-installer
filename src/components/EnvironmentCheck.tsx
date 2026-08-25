import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanLine,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEnvironmentCheck } from "../hooks/useEnvironmentCheck";
import { useEnvironmentRepair } from "../hooks/useEnvironmentRepair";
import { useInstallerStore } from "../store/installerStore";
import { isTauri } from "../lib/env";
import { invoke } from "../lib/rpc";
import { useT, translate, useI18n, localizeBackendLog } from "../lib/i18n";

interface ComfyVersionInfo {
  current: string;
  latest: string;
  latest_date: string;
  outdated: boolean;
  checked: boolean;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "normal") return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />;
}

function statusKey(status: string) {
  if (status === "normal") return "env.status.normal";
  if (status === "warning") return "env.status.warning";
  return "env.status.error";
}

function RepairStepIcon({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" />;
  if (status === "done") return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />;
  return <span className="w-4 h-4 flex-shrink-0" />;
}

export function EnvironmentCheck() {
  const { running, items, summary, error, run } = useEnvironmentCheck();
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const {
    running: repairing,
    steps: repairSteps,
    report,
    error: repairError,
    repair,
    reset: resetRepair,
  } = useEnvironmentRepair();

  const hasIssue = !!summary && (summary.error > 0 || summary.warning > 0);

  const handleRun = () => {
    resetRepair();
    run();
  };

  const [version, setVersion] = useState<ComfyVersionInfo | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const checkVersion = useCallback(async () => {
    const { installDir } = useInstallerStore.getState();
    if (!installDir || !isTauri()) return;
    setCheckingVersion(true);
    setVersionError(null);
    try {
      const res: any = await invoke("check_comfyui_version", { installDir });
      setVersion(res ?? null);
    } catch (e: any) {
      setVersionError(typeof e === "string" ? e : e?.toString?.() ?? translate(useI18n.getState().lang, "env.versionCheckFailed"));
    } finally {
      setCheckingVersion(false);
    }
  }, []);

  const updateVersion = useCallback(async () => {
    const { installDir } = useInstallerStore.getState();
    if (!installDir || !isTauri()) return;
    setUpdating(true);
    setVersionError(null);
    setUpdateResult(null);
    try {
      const msg: string = await invoke("update_comfyui", { installDir });
      setUpdateResult(msg || translate(useI18n.getState().lang, "env.updateDone"));
      await checkVersion();
    } catch (e: any) {
      setVersionError(typeof e === "string" ? e : e?.toString?.() ?? translate(useI18n.getState().lang, "env.updateFailed"));
    } finally {
      setUpdating(false);
    }
  }, [checkVersion]);

  useEffect(() => {
    void checkVersion();
  }, [checkVersion]);

  return (
    <div className="flex-1 min-h-0 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/70 bg-white/95 backdrop-blur p-3 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[13px] font-semibold dark:text-slate-100 text-slate-900">
            {t("env.title")}
          </div>
          <div className="text-[11px] dark:text-slate-500 text-slate-600">
            {t("env.subtitle")}
          </div>
        </div>
        {repairing ? (
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 text-slate-900 text-[12.5px] font-bold"
          >
            <Loader2 className="w-4 h-4 animate-spin" /> {t("env.repairing")}
          </button>
        ) : hasIssue && !report ? (
          <button
            onClick={repair}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-[12.5px] font-bold transition"
          >
            <Wrench className="w-4 h-4" /> {t("env.fix")}
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12.5px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {summary ? t("env.redetect") : t("env.detect")}
          </button>
        )}
      </div>

      {checkingVersion && !version && (
        <div className="mb-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/30 bg-slate-50/70 px-3 py-2.5 flex items-center gap-2 text-[12px] dark:text-slate-400 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> {t("env.checkingVersion")}
        </div>
      )}

      {version && (
        <div
          className={`mb-3 rounded-xl border px-3 py-2.5 flex items-center gap-2.5 flex-wrap text-[12px] ${
            version.outdated
              ? "border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : version.checked
                ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
          }`}
        >
          {version.outdated ? (
            <>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                {t("env.newVersion", { current: version.current, latest: version.latest })}
                {version.latest_date ? `（${version.latest_date}）` : ""}
              </span>
              <button
                onClick={updateVersion}
                disabled={updating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-[12px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {updating ? t("env.updating") : t("env.updateNow")}
              </button>
            </>
          ) : version.checked ? (
            <>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                {t("env.latest", { current: version.current })}
              </span>
            </>
          ) : (
            <span>
              {t("env.version", { current: version.current })}
              {checkingVersion ? t("env.checking") : t("env.offline")}
            </span>
          )}
        </div>
      )}

      {versionError && (
        <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-[12px] dark:text-rose-200 text-rose-800 break-all">
          {versionError}
        </div>
      )}
      {updateResult && (
        <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-[11px] font-mono dark:text-emerald-200 text-emerald-800 break-all max-h-28 overflow-y-auto whitespace-pre-wrap">
          {updateResult}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-[12px] dark:text-rose-200 text-rose-800 break-all">
          {error}
        </div>
      )}
      {repairError && (
        <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-[12px] dark:text-rose-200 text-rose-800 break-all">
          {repairError}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {items.length === 0 && !running && !summary && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
            <ScanLine className="w-8 h-8 dark:text-slate-600 text-slate-400" />
            <div className="text-[12.5px] dark:text-slate-400 text-slate-500">
              {t("env.empty")}
            </div>
          </div>
        )}

        {items.length === 0 && running && (
          <div className="flex items-center gap-2 text-[12.5px] dark:text-slate-400 text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("env.detectingAll")}
          </div>
        )}

        <ul className="space-y-1.5">
          {items.map((it) => (
            <li
              key={it.key}
              className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/30 bg-slate-50/70 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <StatusIcon status={it.status} />
                <span className="text-[12.5px] font-semibold dark:text-slate-100 text-slate-900 w-24 flex-shrink-0">
                  {localizeBackendLog(it.label, lang)}
                </span>
                <span className="text-[12px] dark:text-slate-300 text-slate-700 flex-1 min-w-0 truncate">
                  {localizeBackendLog(it.message, lang)}
                </span>
                <span
                  className={`text-[11px] font-semibold flex-shrink-0 ${
                    it.status === "normal"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : it.status === "warning"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {t(statusKey(it.status))}
                </span>
              </div>
              {it.detail && (
                <div className="mt-1 pl-6 text-[11px] font-mono dark:text-slate-500 text-slate-500 break-all">
                  {localizeBackendLog(it.detail, lang)}
                </div>
              )}
            </li>
          ))}
        </ul>

        {repairSteps.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] font-semibold dark:text-slate-200 text-slate-800 mb-2">
              {repairing ? t("env.repairingNow") : t("env.repairResult")}
            </div>
            <ul className="space-y-1.5">
              {[...repairSteps]
                .sort((a, b) => a.index - b.index)
                .map((s) => (
                  <li
                    key={s.key}
                    className="rounded-lg border dark:border-slate-800 border-slate-200 dark:bg-slate-950/30 bg-slate-50/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <RepairStepIcon status={s.status} />
                      <span className="text-[11px] font-mono dark:text-slate-500 text-slate-500 flex-shrink-0">
                        [{s.index}/{s.total}]
                      </span>
                      <span className="text-[12px] font-semibold dark:text-slate-100 text-slate-900 flex-shrink-0">
                        {localizeBackendLog(s.label, lang)}
                      </span>
                      <span className="text-[11.5px] dark:text-slate-400 text-slate-600 flex-1 min-w-0 truncate">
                        {localizeBackendLog(s.message, lang)}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {summary && (
        <div className="mt-3 pt-3 border-t dark:border-slate-800 border-slate-200 flex items-center gap-4 text-[12px] flex-wrap">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {t("env.normalCount", { n: summary.normal })}
          </span>
          <span className="text-amber-600 dark:text-amber-400 font-semibold">
            {t("env.warningCount", { n: summary.warning })}
          </span>
          <span className="text-rose-600 dark:text-rose-400 font-semibold">
            {t("env.errorCount", { n: summary.error })}
          </span>
          <span className="dark:text-slate-500 text-slate-500">{t("env.done")}</span>

          {report && (
            <>
              <div className="flex-1" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {t("env.fixed", { n: report.fixed })}
              </span>
              {report.failed > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {t("env.failed", { n: report.failed })}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
