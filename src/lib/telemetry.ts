// 统计埋点 / 事件 / 问题上报。统一在启动拉取 manifest 后设置 base 地址，
// 未设置 base 时所有上报静默跳过（离线或未配置 manifest_url 时不影响使用）。

let _baseUrl = "";

export function setTelemetryBaseUrl(url: string) {
  _baseUrl = url;
}

function getInstallId(): string {
  try {
    let id = localStorage.getItem("install_id");
    if (!id) {
      id = "id_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem("install_id", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

async function post(path: string, body: Record<string, unknown>) {
  if (!_baseUrl) return;
  try {
    await fetch(_baseUrl + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // 上报失败不阻塞主流程
  }
}

export function reportTelemetry(event: string, meta?: Record<string, unknown>) {
  void post("/api/telemetry", { installId: getInstallId(), event, meta });
}

export function reportContentEvent(contentType: string, contentId: string, action: string) {
  void post("/api/event", { installId: getInstallId(), contentType, contentId, action });
}

export function reportIssue(category: string, title: string, problem: string, solution: string) {
  void post("/api/issue", { installId: getInstallId(), category, title, problem, solution });
}
