import { useState } from "react";
import { useInstallerStore } from "../store/installerStore";
import { invoke } from "../lib/rpc";
import { useT } from "../lib/i18n";

export function useServiceActions(installDir: string, installMode: string) {
  const t = useT();
  const [headerBusy, setHeaderBusy] = useState(false);
  const setServiceStatus = useInstallerStore((s) => s.setServiceStatus);
  const setServiceBusy = useInstallerStore((s) => s.setServiceBusy);
  const refreshService = useInstallerStore((s) => s.refreshService);
  const appendLog = useInstallerStore((s) => s.appendLog);
  const go = useInstallerStore((s) => s.go);
  const resetInstallState = useInstallerStore((s) => s.resetInstallState);

  const start = async () => {
    if (!installDir) return;
    setHeaderBusy(true);
    setServiceBusy(true);
    setServiceStatus({ status: "starting", last_error: undefined });
    try {
      const res: any = await invoke("start_service", { installDir, installMode });
      appendLog(t("service.log.start", { res: JSON.stringify(res) }));
      setServiceStatus(res);
    } catch (e: any) {
      const msg = e?.toString?.() ?? String(e);
      appendLog(t("service.log.startFailed", { msg }));
      setServiceStatus({ status: "error", last_error: msg });
    } finally {
      setHeaderBusy(false);
      setServiceBusy(false);
      void refreshService();
    }
  };

  const restart = async () => {
    if (!installDir) return;
    setHeaderBusy(true);
    setServiceBusy(true);
    setServiceStatus({ status: "restarting", last_error: undefined });
    try {
      const res: any = await invoke("restart_service", { installDir, installMode });
      appendLog(t("service.log.restart"));
      setServiceStatus(res);
    } catch (e: any) {
      const msg = e?.toString?.() ?? String(e);
      appendLog(t("service.log.restartFailed", { msg }));
      setServiceStatus({ status: "error", last_error: msg });
    } finally {
      setHeaderBusy(false);
      setServiceBusy(false);
      void refreshService();
    }
  };

  const stop = async () => {
    if (!installDir) return;
    setHeaderBusy(true);
    setServiceBusy(true);
    setServiceStatus({ status: "stopping" });
    try {
      const res: any = await invoke("stop_service", { installDir, installMode });
      appendLog(t("service.log.stop"));
      setServiceStatus(res);
    } catch (e: any) {
      const msg = e?.toString?.() ?? String(e);
      appendLog(t("service.log.stopFailed", { msg }));
      setServiceStatus({ status: "error", last_error: msg });
    } finally {
      setHeaderBusy(false);
      setServiceBusy(false);
      void refreshService();
    }
  };

  const uninstall = async (keepModels: boolean) => {
    if (!installDir) return;
    setHeaderBusy(true);
    setServiceBusy(true);
    try {
      const res: any = await invoke("uninstall_service", { installDir, installMode, keepModels });
      appendLog(`[service] ${String(res ?? t("service.log.uninstallDone"))}`);
      resetInstallState();
      go("welcome");
    } catch (e: any) {
      const msg = e?.toString?.() ?? String(e);
      appendLog(t("service.log.uninstallFailed", { msg }));
      setServiceStatus({ status: "error", last_error: msg });
    } finally {
      setHeaderBusy(false);
      setServiceBusy(false);
    }
  };

  const reinstall = () => {
    resetInstallState();
    go("welcome");
  };

  return { headerBusy, start, restart, stop, uninstall, reinstall };
}
