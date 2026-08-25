import { useInstallerStore } from "../store/installerStore";
import type { CheckItem } from "../store/types";
import { localizeBackendLog, useI18n } from "./i18n";
import { listen } from "./sse";

let __installLogInited = false;
let __envCheckInited = false;
let __modelDownloadInited = false;

// 探测本地执行器 /api/health 是否就绪。
export async function waitForTauriInvokeReady(timeoutMs = 2500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("/api/health", { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureInstallLogListenOnce() {
  if (__installLogInited) return;
  __installLogInited = true;
  listen("install_log", (payload: unknown) => {
    try {
      const line = localizeBackendLog(String(payload ?? ""), useI18n.getState().lang);
      useInstallerStore.getState().appendLog(line);
    } catch {}
  });
}

export async function ensureEnvCheckListenOnce() {
  if (__envCheckInited) return;
  __envCheckInited = true;
  listen("detect_progress", (it: CheckItem) => {
    if (!it || typeof it.key !== "string") return;
    const s = useInstallerStore.getState();
    const idx = s.envCheckItems.findIndex((x) => x.key === it.key);
    const next =
      idx >= 0
        ? s.envCheckItems.map((x, i) => (i === idx ? it : x))
        : [...s.envCheckItems, it];
    s.setEnvCheckItems(next);
  });
}

export async function ensureModelDownloadListenOnce() {
  if (__modelDownloadInited) return;
  __modelDownloadInited = true;
  listen("model_download_progress", (p: any) => {
    if (!p || typeof p.file_name !== "string") return;
    useInstallerStore
      .getState()
      .setModelDownloadProgress(p.file_name, p.downloaded ?? 0, p.total ?? 0);
  });
  listen("model_download_done", (p: any) => {
    if (!p || typeof p.file_name !== "string") return;
    useInstallerStore
      .getState()
      .setModelDownloadDone(p.file_name, !!p.ok, localizeBackendLog(p.error ?? "", useI18n.getState().lang));
  });
}
