/* 环境模式：
 *  · Web 化后：前端由本地执行器（Rust 二进制）同源托管，/api/command、/api/events 恒可用。
 *  · isTauri() 保留原名称，但语义变为「本地服务可用」，恒为 true，
 *    使历史代码里 `if (!isTauri())` 的「预览假数据」分支不再触发，一律走真实调用。
 *  · isTauriWindow() 表示 Tauri 无边框窗口（透明背景 + 圆角），Web 化后恒为 false。
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return true;
}

export function isTauriWindow(): boolean {
  return false;
}

export const MOCK_AUTO = false;
