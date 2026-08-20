import { useCallback, useEffect, useState } from "react";
import { isTauri } from "../lib/env";
import { useInstallerStore } from "../store/installerStore";
import { reportIssue } from "../lib/telemetry";
import { translate, useI18n } from "../lib/i18n";
import type { RepairReport, RepairStep } from "../store/types";

export function useEnvironmentRepair() {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<RepairStep[]>([]);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("repair_progress", (e: any) => {
          const step = e.payload as RepairStep;
          if (!step || typeof step.key !== "string") return;
          if (disposed) return;
          setSteps((prev) => {
            const idx = prev.findIndex((x) => x.index === step.index);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = step;
              return next;
            }
            return [...prev, step];
          });
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[env-repair] 监听 repair_progress 失败", err);
      }
    })();
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  const repair = useCallback(async () => {
    const { installDir, installMode } = useInstallerStore.getState();
    setRunning(true);
    setError(null);
    setReport(null);
    setSteps([]);

    if (!isTauri()) {
      setError(translate(useI18n.getState().lang, "env.repairNeedTauri"));
      setRunning(false);
      return;
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res: any = await invoke("repair_environment", {
        installDir,
        installMode,
      });
      setSteps(res?.steps ?? []);
      setReport(res ?? null);

      // 上报检测修复结果：失败项作为待解决问题，成功项作为解决方案沉淀
      for (const s of (res?.steps ?? []) as RepairStep[]) {
        if (s.status === "failed") {
          reportIssue(s.key, s.label, s.message, "");
        } else if (s.status === "done") {
          reportIssue(s.key, s.label, s.label, s.message);
        }
      }
    } catch (e: any) {
      setError(typeof e === "string" ? e : e?.toString?.() ?? translate(useI18n.getState().lang, "env.repairFailed"));
    } finally {
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setReport(null);
    setSteps([]);
    setError(null);
  }, []);

  return { running, steps, report, error, repair, reset };
}
