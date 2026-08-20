// 客户端本地版本号。Tauri 真窗口下从 tauri.conf.json 的 version 读取，
// 浏览器预览环境回退到兜底常量（与 tauri.conf.json 保持同步）。
const APP_VERSION_FALLBACK = "1.0.0";

export async function getAppVersion(): Promise<string> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    const v = await getVersion();
    if (v) return v;
  } catch {
    // 非 Tauri 环境，使用兜底版本号
  }
  return APP_VERSION_FALLBACK;
}
