import { useEffect, useState } from "react";
import { useInstallerStore } from "../store/installerStore";
import { reportDebug } from "../lib/debug";
import { waitForTauriInvokeReady } from "../lib/boot";
import { isTauri } from "../lib/env";
import { translate, useI18n } from "../lib/i18n";

export function useBootstrap() {
  const [envIsTauri, setEnvIsTauri] = useState(() => isTauri());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapMsg, setBootstrapMsg] = useState(() =>
    translate(useI18n.getState().lang, "boot.msg.checking")
  );

  const tr = (key: string, vars?: Record<string, string | number>) =>
    translate(useI18n.getState().lang, key, vars);

  useEffect(() => {
    let canceled = false;
    let settled = false;
    reportDebug("A", "App.tsx:boot-effect-enter", "boot effect entered", {
      initialPage: useInstallerStore.getState().page,
      envIsTauri,
      bootstrapping: true,
    });

    const safetyTimeout = setTimeout(() => {
      if (!canceled && !settled) {
        settled = true;
        reportDebug("A", "App.tsx:boot-safety-timeout", "boot safety timeout hit", {
          page: useInstallerStore.getState().page,
          installDir: useInstallerStore.getState().installDir,
        });
        setBootstrapping(false);
      }
    }, 3500);

    (async () => {
      const st = useInstallerStore.getState();
      const appendLine = (l: string) => st.appendLog(l);
      appendLine(tr("boot.log.startProbe"));

      try {
        const bridgeReady = await waitForTauriInvokeReady(2500);
        setEnvIsTauri(bridgeReady || isTauri());
        const mod = await import("@tauri-apps/api/core").catch(() => null);
        const invoke: any = mod?.invoke;
        if (!invoke) {
          reportDebug("A", "App.tsx:boot-no-invoke", "invoke unavailable in boot flow", {
            href: window.location.href,
            protocol: window.location.protocol,
          });
          appendLine(tr("boot.log.previewMode"));
          if (!canceled) {
            settled = true;
            if (!st.installDir) st.go("welcome");
            clearTimeout(safetyTimeout);
            setBootstrapping(false);
          }
          return;
        }

        let rememberedDir = (() => {
          try {
            return localStorage.getItem("installDir") ?? "";
          } catch {
            return "";
          }
        })();
        if (!rememberedDir && st.installDir && st.installDir !== "D:\\ComfyUI") {
          rememberedDir = st.installDir;
        }
        let candidateDir = rememberedDir || "D:\\ComfyUI";
        let markerHit = false;

        // 1) 全局 marker：installed.json APPDATA / launcher 下 / 兼容 3 件套
        try {
          const marker: any = await invoke("read_install_marker");
          reportDebug("A", "App.tsx:boot-read-marker", "read_install_marker finished", {
            marker,
          });
          if (!canceled && marker?.install_dir) {
            markerHit = true;
            candidateDir = marker.install_dir;
            setBootstrapMsg(tr("boot.msg.found", { dir: marker.install_dir }));
            appendLine(`[auto:boot] read_install_marker → ${marker.install_dir} (${marker.install_mode})`);
          }
        } catch (e: any) {
          appendLine(`[auto:boot] read_install_marker fail: ${e?.message ?? e}`);
        }

        // 2) probe_any_installed：传候选目录
        let probe: any = null;
        try {
          probe = await invoke("probe_any_installed", { candidateDir }).catch((e: any) => {
            reportDebug("A", "App.tsx:boot-probe-fail", "probe_any_installed rejected", {
              candidateDir,
              error: String(e?.message ?? e),
            });
            appendLine(`[auto:boot] probe_any_installed fail: ${e?.message ?? e}`);
            return null;
          });
          reportDebug("A", "App.tsx:boot-probe-result", "probe_any_installed resolved", {
            candidateDir,
            installed: probe?.installed ?? false,
            installDir: probe?.install_dir ?? "",
            mode: probe?.install_mode ?? "",
          });
        } catch (e: any) {
          appendLine(`[auto:boot] probe_any_installed err: ${e?.message ?? e}`);
        }

        if (!canceled && probe?.installed) {
          st.setInstallDir(probe.install_dir);
          st.setInstallMode(probe.install_mode === "docker" ? "docker" : "host");
          if (probe.config?.comfyui_dir) st.setComfyuiDir(probe.config.comfyui_dir);
          if (probe.config?.python_exe) st.setPythonExe(probe.config.python_exe);
          try {
            localStorage.setItem("installDir", probe.install_dir);
          } catch {}
          void st.refreshService().catch(() => void 0);
          st.appendLog(
            tr("boot.log.foundInstalled", {
              dir: probe.install_dir,
              torch: probe.torch_version ?? tr("boot.torchUnknown"),
            }),
          );
          reportDebug("A", "App.tsx:boot-go-manage", "boot flow routed to manage", {
            installDir: probe.install_dir,
            torchVersion: probe.torch_version ?? "",
          });
          st.go("manage");
          settled = true;
          clearTimeout(safetyTimeout);
          setBootstrapping(false);
          return;
        }

        appendLine(tr("boot.log.fallback"));
        if (!canceled) {
          // 明确未安装（本体缺失）→ 直接回欢迎页重新安装，不因残留 marker/目录就进控制台
          if (probe && probe.installed === false) {
            reportDebug("A", "App.tsx:boot-go-welcome-not-installed", "probe says not installed, routing to welcome", {
              candidateDir,
              rememberedDir,
              markerHit,
              probeInstalled: probe?.installed ?? false,
            });
            st.resetInstallState();
            st.go("welcome");
          } else if (markerHit || rememberedDir) {
            st.setInstallDir(candidateDir);
            reportDebug("A", "App.tsx:boot-stay-manage-fallback", "boot probe failed, staying on manage with fallback dir", {
              candidateDir,
              rememberedDir,
              markerHit,
              probeInstalled: probe?.installed ?? false,
            });
            void st.refreshService().catch(() => void 0);
            st.go("manage");
          } else {
            reportDebug("A", "App.tsx:boot-go-welcome", "boot flow routed to welcome", {
              candidateDir,
              rememberedDir,
              markerHit,
              probeInstalled: probe?.installed ?? false,
              currentInstallDir: st.installDir,
            });
            st.go("welcome");
          }
          settled = true;
          clearTimeout(safetyTimeout);
          setBootstrapping(false);
        }
      } catch (e: any) {
        appendLine(`[auto:boot] err: ${e?.message ?? e}`);
        if (!canceled) {
          const fallbackDir = st.installDir || "D:\\ComfyUI";
          reportDebug("A", "App.tsx:boot-error", "boot flow threw", {
            error: String(e?.message ?? e),
            installDir: st.installDir,
            fallbackDir,
          });
          st.setInstallDir(fallbackDir);
          st.go("manage");
          settled = true;
          clearTimeout(safetyTimeout);
          setBootstrapping(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { envIsTauri, bootstrapping, bootstrapMsg };
}
