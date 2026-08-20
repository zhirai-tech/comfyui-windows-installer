import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "../lib/env";

/**
 * 半自动更新：启动时静默检查一次；发现新版本后由用户手动点击下载安装。
 */
export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkedRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!isTauri()) return;
    setChecking(true);
    setError(null);
    try {
      setUpdate(await check());
    } catch (e: unknown) {
      setError(typeof e === "string" ? e : (e as Error)?.toString?.() ?? "check failed");
    } finally {
      setChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return false;
    setDownloading(true);
    setError(null);
    try {
      await update.downloadAndInstall();
      setInstalled(true);
      return true;
    } catch (e: unknown) {
      setError(typeof e === "string" ? e : (e as Error)?.toString?.() ?? "install failed");
      return false;
    } finally {
      setDownloading(false);
    }
  }, [update]);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    void checkForUpdate();
  }, [checkForUpdate]);

  return { update, checking, downloading, installed, error, checkForUpdate, downloadAndInstall };
}
