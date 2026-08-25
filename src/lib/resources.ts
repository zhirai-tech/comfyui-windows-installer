// 资源元数据拉取：只读后端缓存，按类型 + 游标分页。
// 后端地址复用 manifest_url 的 origin（与 telemetry 一致）；未配置时返回空，前端走空态。

import { getManifestBaseUrl } from "./manifest";
import type { BlueprintInfo } from "../store/types";

export interface ResourceMetrics {
  downloads: number;
  likes: number;
  rating: number | null;
  heat: number | null;
  activity: number | null;
  updatedAt: string | null;
  publishedAt: string | null;
}

export interface ResourceItem {
  id: string;
  type: string;
  source: string;
  externalId: string | null;
  externalUrl: string | null;
  name: string;
  nameZh: string | null;
  description: string | null;
  descriptionZh: string | null;
  thumbnail: string | null;
  author: string | null;
  tags: string[];
  metrics: ResourceMetrics;
  filters: Record<string, unknown>;
  publishedAt: string | null;
  updatedAt: string | null;
}

export interface ResourcePage {
  items: ResourceItem[];
  nextCursor: number | null;
  total: number;
}

export async function fetchResources(
  type: string,
  cursor = 0,
  limit = 50
): Promise<ResourcePage> {
  const base = getManifestBaseUrl();
  if (!base) return { items: [], nextCursor: null, total: 0 };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `${base}/api/resources?type=${encodeURIComponent(type)}&cursor=${cursor}&limit=${limit}`,
      { signal: ctrl.signal, cache: "no-store" }
    );
    clearTimeout(timer);
    if (!res.ok) return { items: [], nextCursor: null, total: 0 };
    return (await res.json()) as ResourcePage;
  } catch {
    return { items: [], nextCursor: null, total: 0 };
  }
}

// 解析封面图 URL：外链（Civitai 等）直接用，相对路径（/uploads/...）拼后端 origin。
export function resolveThumbUrl(thumb: string | null): string | null {
  if (!thumb) return null;
  if (/^https?:\/\//i.test(thumb)) return thumb;
  const base = getManifestBaseUrl();
  return base ? `${base}${thumb}` : thumb;
}

// 上传资源封面图/截图，返回后端回写的 thumbnail（相对路径或外链）。
export async function uploadThumbnail(id: string, file: File): Promise<string | null> {
  const base = getManifestBaseUrl();
  if (!base) return null;
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${base}/api/resources/${encodeURIComponent(id)}/thumbnail`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.thumbnail ?? null;
  } catch {
    return null;
  }
}

// 上传「自己平台工作流」封面图/短视频，返回后端回写的 thumbnail。
export async function uploadWorkflowThumbnail(id: string, file: File): Promise<string | null> {
  const base = getManifestBaseUrl();
  if (!base) return null;
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${base}/api/workflows/${encodeURIComponent(id)}/thumbnail`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.thumbnail ?? null;
  } catch {
    return null;
  }
}

// 拉取 ComfyUI 官方模板（blueprints），仅网页端展示用。
export async function fetchBlueprints(): Promise<BlueprintInfo[]> {
  const base = getManifestBaseUrl();
  if (!base) return [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000); // 首次后端要从 GitHub 拉取，给足超时
    const res = await fetch(`${base}/api/blueprints`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

export interface JudgeResult {
  verdict: "installable" | "not_installable" | "unknown";
  reason?: string;
}

// AI 安装判断：后端调用大模型，根据本机检测到的环境 + 资源信息，返回三态判断。
// 后端未配置 / 失败 / 不确定，一律返回 unknown（由调用方走下载兜底）。
export async function judgeInstall(
  resource: { type: string; name: string; description?: string | null },
  environments: string[]
): Promise<JudgeResult> {
  const base = getManifestBaseUrl();
  if (!base) return { verdict: "unknown" };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`${base}/api/ai/judge`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource, environments }),
    });
    clearTimeout(timer);
    if (!res.ok) return { verdict: "unknown" };
    const data = await res.json();
    return {
      verdict: data?.verdict === "installable" || data?.verdict === "not_installable" ? data.verdict : "unknown",
      reason: data?.reason,
    };
  } catch {
    return { verdict: "unknown" };
  }
}
