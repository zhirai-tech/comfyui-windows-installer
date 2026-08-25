import { useInstallerStore } from "../store/installerStore";
import { invoke } from "./rpc";

function log(msg: string) {
  useInstallerStore.getState().appendLog(msg);
}

// 以下窗口级操作在浏览器中无意义，保留空实现以兼容旧调用点。
export async function minimizeWindow() {}
export async function toggleMaximizeWindow() {}
export async function startDraggingWindow() {}
export async function closeWindow() {}

export function onDragRegionMouseDown(_e: { buttons: number; detail: number }) {}

export async function openInstallDir(installDir: string) {
  await openPath(installDir);
}

export async function openResultsDir(installDir: string) {
  if (!installDir) return;
  const dir = `${installDir}\\results`;
  try {
    try {
      await invoke("prepare_results_dir", { dir });
    } catch (e: any) {
      log(`[manage] 创建结果目录 warn: ${e?.toString?.() ?? e}`);
    }
    await openPath(dir);
  } catch (e: any) {
    log(`[manage] 打开结果目录失败: ${e?.toString?.() ?? e}`);
  }
}

export async function openPath(dir: string) {
  if (!dir) return;
  try {
    await invoke("open_path", { path: dir });
  } catch (e: any) {
    log(`[manage] 打开目录失败: ${e?.toString?.() ?? e}`);
  }
}

export async function openExternal(url: string) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}
