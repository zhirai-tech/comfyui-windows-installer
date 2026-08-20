import { useInstallerStore } from "../store/installerStore";
import type { CheckItem } from "../store/types";
import { localizeBackendLog, useI18n } from "./i18n";

let __installLogInited = false;
let __envCheckInited = false;
let __modelDownloadInited = false;

export async function waitForTauriInvokeReady(timeoutMs = 2500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const w = window as any;
    if (w.__TAURI_INTERNALS__?.invoke || w.__TAURI__?.core?.invoke) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

export async function ensureInstallLogListenOnce() {
  if (__installLogInited) return;
  const w = window as any;
  if (w.__installLogSubscribed) {
    __installLogInited = true;
    return;
  }
  const isTauriEnv =
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
  if (!isTauriEnv) {
    __installLogInited = true;
    return;
  }
  let unsub: (() => void) | null = null;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    unsub = await listen("install_log", (e: any) => {
      try {
        const line = localizeBackendLog(String(e.payload ?? ""), useI18n.getState().lang);
        useInstallerStore.getState().appendLog(line);
      } catch {}
    });
    w.__installLogSubscribed = true;
    w.__installLogUnsub = () => {
      try {
        if (unsub) unsub();
      } catch {}
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[listen] 非 Tauri 环境，跳过 install_log 监听", err);
  } finally {
    __installLogInited = true;
  }
}

export async function ensureEnvCheckListenOnce() {
  if (__envCheckInited) return;
  __envCheckInited = true;
  const isTauriEnv =
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
  if (!isTauriEnv) return;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen("detect_progress", (e: any) => {
      const it = e.payload as CheckItem;
      if (!it || typeof it.key !== "string") return;
      const s = useInstallerStore.getState();
      const idx = s.envCheckItems.findIndex((x) => x.key === it.key);
      const next =
        idx >= 0
          ? s.envCheckItems.map((x, i) => (i === idx ? it : x))
          : [...s.envCheckItems, it];
      s.setEnvCheckItems(next);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[listen] detect_progress 监听失败", err);
  }
}

export async function ensureModelDownloadListenOnce() {
  if (__modelDownloadInited) return;
  __modelDownloadInited = true;
  const isTauriEnv =
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
  if (!isTauriEnv) return;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen("model_download_progress", (e: any) => {
      const p = e.payload as { file_name?: string; downloaded?: number; total?: number };
      if (!p || typeof p.file_name !== "string") return;
      useInstallerStore
        .getState()
        .setModelDownloadProgress(p.file_name, p.downloaded ?? 0, p.total ?? 0);
    });
    await listen("model_download_done", (e: any) => {
      const p = e.payload as { file_name?: string; ok?: boolean; error?: string };
      if (!p || typeof p.file_name !== "string") return;
      useInstallerStore
        .getState()
        .setModelDownloadDone(p.file_name, !!p.ok, localizeBackendLog(p.error ?? "", useI18n.getState().lang));
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[listen] model_download 监听失败", err);
  }
}
