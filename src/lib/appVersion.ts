// 本地执行器版本号。与 src-tauri/Cargo.toml 的 version 保持一致。
const APP_VERSION = "1.1.0";

export async function getAppVersion(): Promise<string> {
  return APP_VERSION;
}
