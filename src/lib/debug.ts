// 生产环境不再上报调试信息，reportDebug 保持空实现，避免向本地调试服务发起网络请求。
export function reportDebug(
  _hypothesisId: string,
  _location: string,
  _msg: string,
  _data: Record<string, unknown> = {},
) {
  // no-op
}
