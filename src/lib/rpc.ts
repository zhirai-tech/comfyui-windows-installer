// 本地执行器 RPC 封装：替代原 Tauri invoke。
// 前端由 Rust 本地执行器同源托管，直接 POST /api/command。
export async function invoke<T = any>(
  command: string,
  args?: Record<string, any>
): Promise<T> {
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, args: args ?? {} }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) {
    throw new Error(json.error ?? `命令执行失败: ${command}`);
  }
  return json.data as T;
}
