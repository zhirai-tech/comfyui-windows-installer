import { useRef, useState } from "react";
import { useInstallerStore } from "../store/installerStore";
import type { InstallStep } from "../store/installerStore";
import { PRESET_WORKFLOWS } from "../lib/presetWorkflows";
import localVersions from "../../config/versions.json";
import { sleep } from "../lib/utils";
import { useT, useLocalize } from "../lib/i18n";

export function useInstallFlow() {
  const t = useT();
  const L = useLocalize();
  const started = useRef(false);
  const [doneBanner, setDoneBanner] = useState<null | "done" | "starting" | "running">(null);

  const installDir = useInstallerStore((s) => s.installDir);
  const installMode = useInstallerStore((s) => s.installMode);
  const versionsConfig = useInstallerStore((s) => s.versionsConfig) ?? localVersions;
  const gpuInfo = useInstallerStore((s) => s.gpuInfo) ?? {};
  const manifestContent = useInstallerStore((s) => s.manifestContent);

  const presetWorkflows = manifestContent?.workflows?.length
    ? manifestContent.workflows
    : PRESET_WORKFLOWS;

  const appendLog = useInstallerStore((s) => s.appendLog);
  const resetInstall = useInstallerStore((s) => s.resetInstall);
  const setError = useInstallerStore((s) => s.setError);
  const setRunning = useInstallerStore((s) => s.setRunning);
  const setPythonExe = useInstallerStore((s) => s.setPythonExe);
  const setComfyuiDir = useInstallerStore((s) => s.setComfyuiDir);
  const setDockerInfo = useInstallerStore((s) => s.setDockerInfo);
  const setStepRunning = useInstallerStore((s) => s.setStepRunning);
  const setStepProgress = useInstallerStore((s) => s.setStepProgress);
  const setStepSuccess = useInstallerStore((s) => s.setStepSuccess);
  const setStepError = useInstallerStore((s) => s.setStepError);

  const runRealStep = async (
    stepKey: InstallStep,
    task: () => Promise<void>,
    fallbackProgressMs = 1500
  ) => {
    setStepRunning(stepKey);
    setStepProgress(stepKey, 3);
    let finished = false;
    const addPerTick = Math.max(1, Math.min(3, Math.round(2500 / Math.max(500, fallbackProgressMs))));
    const tickMs = Math.max(3000, Math.round(fallbackProgressMs / 10));
    const tick = setInterval(() => {
      if (finished) return;
      useInstallerStore.getState().setStepProgress(
        stepKey,
        Math.min(95, (useInstallerStore.getState().steps.find((s) => s.key === stepKey)?.progress ?? 0) + addPerTick)
      );
    }, tickMs);
    try {
      await task();
      finished = true;
      clearInterval(tick);
      setStepProgress(stepKey, 100);
      setStepSuccess(stepKey);
    } catch (e) {
      finished = true;
      clearInterval(tick);
      setStepError(stepKey, typeof e === "string" ? e : String(e));
      throw e;
    }
  };

  const runHostFlow = async (total: number) => {
    const { invoke } = await import("@tauri-apps/api/core");
    let pythonExe = "";
    let comfyuiDir = "";
    const venvPython = `${installDir}\\venv\\Scripts\\python.exe`;

    appendLog(t("install.log.python", { i: 1, total }));
    await runRealStep("python", async () => {
      const res: any = await invoke("prepare_python", { installDir, versionsConfig });
      pythonExe = res?.executable ?? "";
      setPythonExe(pythonExe);
    }, 8000);

    appendLog(
      versionsConfig?.comfyui?.selection_mode === "custom"
        ? t("install.log.comfyuiCustom", {
            i: 2,
            total,
            ref: versionsConfig?.comfyui?.selected_ref ?? versionsConfig?.comfyui?.target_branch ?? "-",
          })
        : t("install.log.comfyuiLatest", { i: 2, total })
    );
    await runRealStep("comfyui", async () => {
      const res: any = await invoke("download_comfyui", { installDir, versionsConfig });
      comfyuiDir = res?.comfyui_dir ?? `${installDir}\\ComfyUI`;
      setComfyuiDir(comfyuiDir);
    }, 20000);

    appendLog(t("install.log.venv", { i: 3, total }));
    await runRealStep("venv", async () => {
      await invoke("run_install_step", { step: "venv", installDir, pythonExe, comfyuiDir, versionsConfig, gpuInfo });
    }, 10000);

    appendLog(t("install.log.pytorch", { i: 4, total }));
    await runRealStep("pytorch", async () => {
      await invoke("run_install_step", { step: "pytorch", installDir, pythonExe, comfyuiDir, versionsConfig, gpuInfo });
    }, 10000);

    appendLog(t("install.log.deps", { i: 5, total }));
    await runRealStep("deps", async () => {
      await invoke("run_install_step", { step: "deps", installDir, pythonExe, comfyuiDir, versionsConfig, gpuInfo });
    }, 120000);

    appendLog(t("install.log.config", { i: 6, total }));
    await runRealStep("config", async () => {
      await invoke("run_install_step", { step: "config", installDir, pythonExe, comfyuiDir, versionsConfig, gpuInfo });
      await invoke("write_install_config", {
        config: {
          install_dir: installDir,
          python_exe: pythonExe,
          comfyui_dir: comfyuiDir,
          venv_python: venvPython,
          gpu_name: (gpuInfo as any)?.gpu_name ?? "-",
          vram_gb: (gpuInfo as any)?.vram_gb ?? 0,
          installed_at: new Date().toISOString(),
          install_mode: "host",
        },
      });
    }, 6000);
  };

  const runDockerFlow = async (total: number) => {
    const { invoke } = await import("@tauri-apps/api/core");

    appendLog(t("install.log.dockerCheck", { i: 1, total }));
    await runRealStep("docker_check", async () => {
      const res: any = await invoke("check_docker");
      setDockerInfo(res);
      if (res?.installed === false || res?.running === false) {
        throw new Error(t("install.dockerNotReady"));
      }
    }, 4000);

    appendLog(t("install.log.data", { i: 2, total }));
    await runRealStep("data", async () => {
      await invoke("install_docker_mode", { installDir, versionsConfig, stepPhase: "prepare" });
      await invoke("install_docker_mode", { installDir, versionsConfig, stepPhase: "write_compose" });
    }, 6000);

    appendLog(t("install.log.dockerPull", { i: 3, total }));
    await runRealStep("docker_pull", async () => {
      await invoke("install_docker_mode", { installDir, versionsConfig, stepPhase: "pull" });
    }, 600000);

    appendLog(t("install.log.composeUp", { i: 4, total }));
    await runRealStep("compose", async () => {
      await invoke("install_docker_mode", { installDir, versionsConfig, stepPhase: "compose_up" });
    }, 45000);

    appendLog(t("install.log.config", { i: 5, total }));
    await runRealStep("config", async () => {
      await invoke("write_install_config", {
        config: {
          install_dir: installDir,
          python_exe: "",
          comfyui_dir: "",
          venv_python: "",
          gpu_name: (gpuInfo as any)?.gpu_name ?? "-",
          vram_gb: (gpuInfo as any)?.vram_gb ?? 0,
          installed_at: new Date().toISOString(),
          install_mode: "docker",
        },
      });
    }, 5000);
  };

  const runAll = async () => {
    resetInstall();
    setRunning(true);
    setError(null);

    try {
      const total = useInstallerStore.getState().steps.length;
      if (installMode === "host") {
        await runHostFlow(total);
      } else {
        await runDockerFlow(total);
      }

      appendLog(t("install.log.allDone"));

      // 预置工作流（仅宿主机版；容器版工作流目录挂载在容器内，暂不预置）
      if (installMode === "host") {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          for (const w of presetWorkflows) {
            const content = JSON.stringify(w.graph, null, 2);
            await invoke("install_preset_workflow", {
              installDir,
              fileName: w.fileName,
              content,
            });
            appendLog(t("install.log.presetWorkflow", { name: L(w.name) }));
          }
        } catch (e) {
          appendLog(t("install.log.presetWarn", { err: String(e) }));
        }
      }

      setRunning(false);
      setDoneBanner("done");
      const setServiceStatus = useInstallerStore.getState().setServiceStatus;
      await sleep(400);
      setDoneBanner("starting");
      setServiceStatus({ status: "starting" });

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        if (installMode === "host") {
          await invoke("launch_comfyui", { installDir });
        }
      } catch (e) {
        appendLog(t("install.log.launchWarn", { err: String(e) }));
      }

      await sleep(installMode === "docker" ? 3500 : 1500);

      setDoneBanner("running");
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const statusRes: any = await invoke("get_service_status", { installDir, installMode });
        setServiceStatus({
          status: statusRes?.status ?? "unknown",
          url: statusRes?.url ?? undefined,
          port: statusRes?.port ?? undefined,
          pid: statusRes?.pid ?? undefined,
          started_at: statusRes?.started_at ?? undefined,
          last_error: statusRes?.last_error ?? undefined,
        });
        if (statusRes?.status === "running" || installMode === "docker") {
          appendLog(t("install.log.ready"));
        } else {
          appendLog(t("install.log.status", { status: statusRes?.status ?? "unknown" }));
        }
      } catch (_e) {
        setServiceStatus({ status: "unknown" });
        appendLog(t("install.log.notDetected"));
      }
      setTimeout(() => useInstallerStore.getState().go("manage"), 500);
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.toString?.() ?? t("install.unknownError");
      appendLog(`[error] ${msg}`);
      const current = useInstallerStore.getState().steps.find((s) => s.status === "running");
      if (current) setStepError(current.key, msg);
      setError(msg);
    }
  };

  return { runAll, started, doneBanner };
}
