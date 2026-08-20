import { useInstallerStore } from "../store/installerStore";
import { isTauri } from "./env";

function log(msg: string) {
  useInstallerStore.getState().appendLog(msg);
}

export async function minimizeWindow() {
  try {
    const mod = await import("@tauri-apps/api/window");
    await mod.getCurrentWindow().minimize();
  } catch (e: any) {
    log(`[window] 最小化失败: ${e?.toString?.() ?? e}`);
  }
}

export async function toggleMaximizeWindow() {
  try {
    const mod = await import("@tauri-apps/api/window");
    const win = mod.getCurrentWindow();
    const maximized = await win.isMaximized();
    if (maximized) await win.unmaximize();
    else await win.maximize();
  } catch (e: any) {
    log(`[window] 最大化切换失败: ${e?.toString?.() ?? e}`);
  }
}

export async function startDraggingWindow() {
  try {
    const mod = await import("@tauri-apps/api/window");
    await mod.getCurrentWindow().startDragging();
  } catch (e: any) {
    log(`[window] 开始拖动失败: ${e?.toString?.() ?? e}`);
  }
}

/** 标题栏拖动：左键拖动窗口，双击切换最大化。替代 data-tauri-drag-region（后者只对直接元素生效，无法作用于子元素）。 */
export function onDragRegionMouseDown(e: { buttons: number; detail: number }) {
  if (e.buttons !== 1) return;
  if (e.detail === 2) void toggleMaximizeWindow();
  else void startDraggingWindow();
}

export async function closeWindow() {
  try {
    const mod = await import("@tauri-apps/api/window");
    await mod.getCurrentWindow().close();
  } catch (e: any) {
    log(`[window] 关闭窗口失败: ${e?.toString?.() ?? e}`);
  }
}

export async function openInstallDir(installDir: string) {
  if (!installDir) return;
  try {
    const mod = await import("@tauri-apps/plugin-shell");
    await mod.open(installDir);
  } catch (e: any) {
    log(`[manage] 打开安装目录失败: ${e?.toString?.() ?? e}`);
  }
}

export async function openResultsDir(installDir: string) {
  if (!installDir) return;
  const dir = `${installDir}\\results`;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      await invoke("prepare_results_dir", { dir });
    } catch (e: any) {
      log(`[manage] 创建结果目录 warn: ${e?.toString?.() ?? e}`);
    }
    const mod = await import("@tauri-apps/plugin-shell");
    await mod.open(dir);
  } catch (e: any) {
    log(`[manage] 打开结果目录失败: ${e?.toString?.() ?? e}`);
  }
}

export async function openPath(dir: string) {
  if (!dir) return;
  try {
    const mod = await import("@tauri-apps/plugin-shell");
    await mod.open(dir);
  } catch (e: any) {
    log(`[manage] 打开目录失败: ${e?.toString?.() ?? e}`);
  }
}

export async function openExternal(url: string) {
  if (!url) return;
  if (isTauri()) {
    try {
      const mod = await import("@tauri-apps/plugin-shell");
      await mod.open(url);
      return;
    } catch (e: any) {
      log(`[window] 打开链接失败: ${e?.toString?.() ?? e}`);
      return;
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
