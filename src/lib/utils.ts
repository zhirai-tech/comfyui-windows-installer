// 通用工具函数，避免在多个组件里重复定义。

export function formatBytes(bytes: number): string {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
