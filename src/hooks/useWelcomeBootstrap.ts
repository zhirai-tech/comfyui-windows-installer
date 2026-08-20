import { useEffect, useState } from "react";
import { useInstallerStore } from "../store/installerStore";
import { reportDebug } from "../lib/debug";
import { buildVersionsConfig } from "../lib/versions";
import localVersions from "../../config/versions.json";
import { translate, useI18n } from "../lib/i18n";

export function useWelcomeBootstrap() {
  const installMode = useInstallerStore((s) => s.installMode);
  const comfyuiVersionMode = useInstallerStore((s) => s.comfyuiVersionMode);
  const comfyuiVersionRef = useInstallerStore((s) => s.comfyuiVersionRef);
  const setComfyuiVersionSelection = useInstallerStore((s) => s.setComfyuiVersionSelection);
  const versionsConfig = useInstallerStore((s) => s.versionsConfig);
  const setInstallDir = useInstallerStore((s) => s.setInstallDir);
  const setVersionsConfig = useInstallerStore((s) => s.setVersionsConfig);
  const installDir = useInstallerStore((s) => s.installDir);
  const appendLog = useInstallerStore((s) => s.appendLog);

  const tr = (key: string, vars?: Record<string, string | number>) =>
    translate(useI18n.getState().lang, key, vars);

  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);

  const applyVersionConfig = (
    mode: "latest" | "custom",
    ref: string,
    baseConfig?: any
  ) => {
    setComfyuiVersionSelection(mode, ref);
    setVersionsConfig(buildVersionsConfig(baseConfig ?? versionsConfig ?? localVersions, mode, ref));
  };

  useEffect(() => {
    let canceled = false;
    // #region debug-point C:welcome-enter
    reportDebug("C", "Welcome.tsx:effect-enter", "welcome guard entered", {
      installDir,
      installMode,
    });
    // #endregion
    (async () => {
      applyVersionConfig(comfyuiVersionMode, comfyuiVersionRef, localVersions);

      try {
        const mod = await import("@tauri-apps/api/core").catch(() => null);
        const invoke: any = mod?.invoke;
        if (invoke) {
          try {
            const def: string = await invoke("pick_default_install_dir");
            if (def) setInstallDir(def);
          } catch (e) {
            appendLog(tr("welcome.log.dirFailed", { msg: String(e) }));
          }
        }
      } catch {}

      try {
        const st = useInstallerStore.getState();
        if (typeof st.refreshService === "function") {
          try { await st.refreshService().catch(() => void 0); } catch {}
        }

        const mod = await import("@tauri-apps/api/core").catch(() => null);
        const invoke: any = mod?.invoke;
        if (!invoke) {
          if (!canceled) setLoading(false);
          return;
        }

        const persisted = (() => {
          try { return localStorage.getItem("installDir") ?? ""; } catch { return ""; }
        })();
        let candidate = persisted;
        try {
          const marker: any = await invoke("read_install_marker").catch(() => null);
          if (!canceled && marker?.install_dir) candidate = marker.install_dir;
        } catch {}
        try {
          const probe: any = await invoke("probe_any_installed", { candidateDir: candidate }).catch(() => null);
          // #region debug-point C:welcome-probe
          reportDebug("C", "Welcome.tsx:probe", "welcome probe resolved", {
            candidate,
            installed: probe?.installed ?? false,
            installDir: probe?.install_dir ?? "",
          });
          // #endregion
          if (!canceled && probe?.installed) {
            st.setInstallDir(probe.install_dir);
            st.setInstallMode(probe.install_mode === "docker" ? "docker" : "host");
            if (probe.config?.comfyui_dir) st.setComfyuiDir(probe.config.comfyui_dir);
            if (probe.config?.python_exe) st.setPythonExe(probe.config.python_exe);
            try { localStorage.setItem("installDir", probe.install_dir); } catch {}
            void st.refreshService().catch(() => void 0);
            st.appendLog(tr("welcome.log.foundInstalled", { dir: probe.install_dir }));
            // #region debug-point C:welcome-go-manage
            reportDebug("C", "Welcome.tsx:go-manage", "welcome redirected to manage", {
              installDir: probe.install_dir,
            });
            // #endregion
            st.go("manage");
            return;
          }
        } catch {}
        try {
          const cfg = `${installDir}/launcher/config.json`.replace(/\//g, "\\");
          const exists: unknown = await invoke("has_install_config", { cfgPath: cfg }).catch(() => false);
          if (!canceled && exists) setHasExisting(true);
        } catch {}
      } catch {}
      if (!canceled) setLoading(false);
    })();
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { loading, hasExisting, applyVersionConfig };
}
