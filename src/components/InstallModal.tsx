import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, X } from "lucide-react";
import { useT } from "../lib/i18n";
import { openExternal } from "../lib/window";
import { invoke } from "../lib/rpc";
import { judgeInstall } from "../lib/resources";
import { useInstallerStore } from "../store/installerStore";
import { useInstallModalStore, type InstallTarget } from "../store/installModalStore";

type Stage =
  | "checking-executor"
  | "no-executor"
  | "downloading-executor"
  | "checking-env"
  | "no-platform"
  | "matched";

export function InstallModal() {
  const t = useT();
  const target = useInstallModalStore((s) => s.target);
  const close = useInstallModalStore((s) => s.close);

  const [stage, setStage] = useState<Stage>("checking-executor");
  const [detail, setDetail] = useState<string>("");
  const polling = useRef(false);

  const checkExecutor = useCallback(async () => {
    const st = useInstallerStore.getState();
    return st.checkExecutor();
  }, []);

  // 检测宿主机 AI 环境，返回「已检测到的平台清单」（如 ["ComfyUI"]）。
  const detectEnvironments = useCallback(async (): Promise<string[]> => {
    const st = useInstallerStore.getState();
    const { installDir, installMode } = st;
    if (!installDir) return [];
    try {
      const res: any = await invoke("detect_environment", { installDir, installMode });
      const items: any[] = res?.items ?? [];
      const found: string[] = [];
      if (items.some((i) => i?.key === "comfyui" && i?.status === "normal")) {
        found.push("ComfyUI");
      }
      // 后续可在此扩展 Ollama / Open WebUI 等其它平台探测项。
      return found;
    } catch {
      return [];
    }
  }, []);

  // 检测环境 + 调大模型判断，得到最终阶段与文案。
  const runDetectAndJudge = useCallback(
    async (tgt: InstallTarget) => {
      const environments = await detectEnvironments();

      // 环境清单为空：无任何可安装宿主，直接走下载兜底
      if (environments.length === 0) {
        setStage("no-platform");
        setDetail(t("mk.noPlatformDetail", { name: tgt.name }));
        return;
      }

      const result = await judgeInstall(
        { type: tgt.type, name: tgt.name, description: tgt.description ?? null },
        environments
      );

      if (result.verdict === "installable") {
        setStage("matched");
        setDetail(result.reason || t("mk.matchedDetail", { name: tgt.name }));
        if (tgt.externalUrl) openExternal(tgt.externalUrl);
      } else {
        // not_installable / unknown：一律下载兜底
        setStage("no-platform");
        setDetail(
          result.verdict === "not_installable"
            ? t("mk.noPlatformDetail", { name: tgt.name })
            : t("mk.unknownDetail", { name: tgt.name })
        );
      }
    },
    [detectEnvironments, t]
  );

  // 打开弹窗即开始检测执行器
  useEffect(() => {
    if (!target) return;
    let alive = true;
    polling.current = false;
    setStage("checking-executor");
    setDetail("");

    (async () => {
      const online = await checkExecutor();
      if (!alive) return;
      if (online) {
        setStage("checking-env");
        await runDetectAndJudge(target);
      } else {
        setStage("no-executor");
        setDetail(t("mk.noExecutorDetail"));
      }
    })();

    return () => {
      alive = false;
      polling.current = false;
    };
  }, [target, checkExecutor, runDetectAndJudge, t]);

  // 点击「安装」→ 下载执行器并引导安装，随后轮询 /api/health 直到在线。
  const handleInstallExecutor = async () => {
    const st = useInstallerStore.getState();
    const url = st.manifestContent?.downloadUrl ?? null;
    if (url) openExternal(url);
    setStage("downloading-executor");
    setDetail(t("mk.executorDownloading"));

    polling.current = true;
    for (let i = 0; i < 30 && polling.current; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const online = await checkExecutor();
      if (online) {
        setStage("checking-env");
        await runDetectAndJudge(target!);
        polling.current = false;
        return;
      }
    }
  };

  if (!target) return null;

  const typeLabel =
    target.type === "agent" ? t("res.type.agent") : target.type === "model" ? t("res.type.model") : t("res.type.workflow");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/55 dark:bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-slate-800 border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-bold dark:text-slate-100 text-slate-900">
            {stage === "matched" ? (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
            ) : stage === "no-platform" || stage === "no-executor" ? (
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
            ) : (
              <Loader2 className="w-4.5 h-4.5 text-brand-500 animate-spin" />
            )}
            {t("mk.modalTitle")}
          </div>
          <button
            onClick={close}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-500/10 transition dark:text-slate-400 text-slate-600"
            title={t("common.close")}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="text-[12px] leading-relaxed dark:text-slate-300 text-slate-600 break-all">
            {stage === "checking-executor" && t("mk.checkingExecutor")}
            {stage === "checking-env" && t("mk.checkingEnv")}
            {stage === "no-executor" && detail}
            {stage === "downloading-executor" && detail}
            {stage === "no-platform" && detail}
            {stage === "matched" && detail}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] dark:text-slate-500 text-slate-500">
            <span className="truncate">{target.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold leading-none bg-slate-200/70 dark:bg-slate-800 shrink-0">
              {typeLabel}
            </span>
          </div>

          {/* 未检测到执行器：安装 / 取消 */}
          {stage === "no-executor" && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleInstallExecutor}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12px] font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                {t("mk.installExecutor")}
              </button>
              <button
                onClick={close}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-full border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-700 text-[12px] font-bold hover:bg-slate-500/10 transition"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}

          {/* 环境不可安装 / 不确定：下载 / 取消 */}
          {stage === "no-platform" && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  if (target.externalUrl) openExternal(target.externalUrl);
                  close();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-white text-[12px] font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                {t("mk.download")}
              </button>
              <button
                onClick={close}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-full border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-700 text-[12px] font-bold hover:bg-slate-500/10 transition"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}

          {/* 匹配成功：关闭即可（已跳转） */}
          {stage === "matched" && (
            <button
              onClick={close}
              className="w-full inline-flex items-center justify-center px-3 py-2 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[12px] font-bold transition"
            >
              {t("common.ok")}
            </button>
          )}

          {/* 检测中 / 下载执行器中：仅关闭 */}
          {(stage === "checking-executor" || stage === "checking-env" || stage === "downloading-executor") && (
            <button
              onClick={close}
              className="w-full inline-flex items-center justify-center px-3 py-2 rounded-full border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-700 text-[12px] font-bold hover:bg-slate-500/10 transition"
            >
              {t("common.cancel")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
