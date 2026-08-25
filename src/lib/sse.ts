// 本地执行器 SSE 事件监听：替代原 Tauri event.listen。
// 后端 /api/events 以 Server-Sent Events 推送 install_log / detect_progress 等事件。
export type EventHandler<T = any> = (payload: T) => void;

let source: EventSource | null = null;
const handlers = new Map<string, Set<EventHandler>>();

function ensureSource(): EventSource {
  if (source) return source;
  const es = new EventSource("/api/events");
  // 断线由浏览器自动重连；这里不额外处理，避免噪声。
  source = es;
  return es;
}

export function listen<T = any>(event: string, handler: EventHandler<T>): () => void {
  const es = ensureSource();
  const wrapped: EventHandler = (payload) => handler(payload);

  if (!handlers.has(event)) {
    handlers.set(event, new Set());
    es.addEventListener(event, (e: MessageEvent) => {
      const raw = (e as MessageEvent & { data?: string }).data;
      let payload: any = raw;
      if (typeof raw === "string") {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }
      handlers.get(event)?.forEach((fn) => fn(payload));
    });
  }

  handlers.get(event)!.add(wrapped);
  return () => {
    handlers.get(event)?.delete(wrapped);
  };
}
