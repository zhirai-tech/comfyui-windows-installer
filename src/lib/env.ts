/* 环境模式：
 *  · 用户明确要求「全部换成真实的」，所以永久强制 MOCK_AUTO = false，所有页面一律真调 Tauri invoke
 *  · 不再判断 isTauri()，用户明确说要真实部署，就不要再跑假流程假数据了
 *  · 后期要切回前端 Chrome 测试，把下一行改成 MOCK_AUTO = true 即可
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;
}

export const MOCK_AUTO = false; // 用户要求：彻底关闭 MOCK，全部真实调用！
