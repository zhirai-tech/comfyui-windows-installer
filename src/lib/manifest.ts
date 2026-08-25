import localVersions from "../../config/versions.json";
import { PRESET_WORKFLOWS, type PresetWorkflow, type WorkflowDependency } from "./presetWorkflows";
import { PRESET_MODELS, type PresetModel } from "./presetModels";
import { CONTACT_CHANNELS, type ContactChannel } from "./contact";
import type { LocalizedText } from "./i18n";

export interface RemoteContact {
  id: string;
  label: string;
  value: string | null;
  kind: string;
  url: string | null;
  qrImage: string | null;
  hint: string | null;
}

export interface RemoteModel {
  id: string;
  name: string;
  fileName: string | null;
  category: string | null;
  url: string | null;
  sizeHint: string | null;
  description: string | null;
}

export interface RemoteWorkflow {
  id: string;
  name: string;
  fileName: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  publishedAt: string | null;
  likes: number;
  downloads: number;
  dependencies: PresetWorkflow["dependencies"];
  graph: Record<string, unknown> | null;
  minVramGb?: number | null;
  gpuHint?: { zh: string; en: string } | null;
  thumbnail?: string | null;
}

export interface RemoteAnnouncement {
  id: number;
  level: string;
  title: string;
  body: string | null;
  date: string | null;
}

export interface RemoteManifest {
  installer_latest_version?: string;
  installer_downloads?: { url: string; sha256?: string }[];
  manifest_url?: string;
  contact?: RemoteContact[];
  models?: RemoteModel[];
  workflows?: RemoteWorkflow[];
  announcements?: RemoteAnnouncement[];
  [key: string]: unknown;
}

export interface ManifestContent {
  contact: ContactChannel[];
  models: PresetModel[];
  workflows: PresetWorkflow[];
  announcements: RemoteAnnouncement[];
  latestVersion: string | null;
  downloadUrl: string | null;
  source: "remote" | "local";
}

const MANIFEST_TIMEOUT_MS = 6000;
const PLACEHOLDER_MARK = "your-cdn.example.com";
const MANIFEST_URL_STORAGE_KEY = "zhirai.manifestUrl";

/** 内嵌默认的 manifest 地址（写死在 versions.json 里，随 exe 分发） */
function defaultManifestUrl(): string | null {
  const url = (localVersions as any).manifest_url;
  if (typeof url !== "string" || !url) return null;
  if (url.includes(PLACEHOLDER_MARK)) return null;
  return url;
}

/** 当前生效的 manifest 地址：用户本地覆盖优先，否则回退内嵌默认 */
export function getManifestUrl(): string | null {
  try {
    const override = localStorage.getItem(MANIFEST_URL_STORAGE_KEY);
    if (override !== null) {
      const trimmed = override.trim();
      if (trimmed) return trimmed;
    }
  } catch {
    /* ignore */
  }
  return defaultManifestUrl();
}

/** 设置 manifest 地址；传空串表示清除覆盖、恢复默认 */
export function setManifestUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) localStorage.setItem(MANIFEST_URL_STORAGE_KEY, trimmed);
    else localStorage.removeItem(MANIFEST_URL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function localManifestUrl(): string | null {
  return getManifestUrl();
}

/** 从 manifest_url 推导上报接口的 base（origin），失败返回空串 */
export function resolveBaseUrl(manifestUrl: string): string {
  try {
    return new URL(manifestUrl).origin;
  } catch {
    return "";
  }
}

/** 上报接口的 base（用于 telemetry），未配置有效 manifest_url 时返回空串 */
export function getManifestBaseUrl(): string {
  const url = localManifestUrl();
  return url ? resolveBaseUrl(url) : "";
}

export async function fetchRemoteManifest(): Promise<RemoteManifest | null> {
  const url = localManifestUrl();
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MANIFEST_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as RemoteManifest;
  } catch {
    return null;
  }
}

function toContact(remote: RemoteContact[] | undefined): ContactChannel[] {
  if (!remote?.length) return CONTACT_CHANNELS;
  return remote.map((c) => ({
    id: c.id,
    label: toLocalized(c.label),
    value: c.value ?? "",
    kind: (c.kind as ContactChannel["kind"]) || "link",
    url: c.url ?? undefined,
    qrImage: c.qrImage ?? undefined,
    hint: c.hint ? toLocalized(c.hint) : undefined,
  }));
}

function toLocalized(s: string): LocalizedText {
  return { zh: s, en: s };
}

function toDependency(d: any): WorkflowDependency {
  const label: LocalizedText =
    typeof d.label === "string"
      ? toLocalized(d.label)
      : d.label && typeof d.label.zh === "string"
      ? { zh: d.label.zh, en: d.label.en ?? d.label.zh }
      : toLocalized(d.name ?? "");
  return {
    kind: d.kind,
    name: d.name ?? "",
    label,
    ...(d.git_url ? { git_url: d.git_url } : {}),
  };
}

function toModels(remote: RemoteModel[] | undefined): PresetModel[] {
  if (!remote?.length) return PRESET_MODELS;
  return remote.map((m) => ({
    id: m.id,
    name: toLocalized(m.name),
    fileName: m.fileName ?? "",
    category: m.category ?? "checkpoints",
    url: m.url ?? "",
    sizeHint: toLocalized(m.sizeHint ?? ""),
    description: toLocalized(m.description ?? ""),
  }));
}

function toWorkflows(remote: RemoteWorkflow[] | undefined): PresetWorkflow[] {
  if (!remote?.length) return PRESET_WORKFLOWS;
  const localById = new Map(PRESET_WORKFLOWS.map((w) => [w.id, w]));
  const merged: PresetWorkflow[] = remote.map((w) => {
    const local = localById.get(w.id);
    const remoteDeps = (w.dependencies?.length ? w.dependencies : local?.dependencies) ?? [];
    return {
      id: w.id,
      name: toLocalized(w.name),
      fileName: w.fileName ?? w.name,
      description: toLocalized(w.description ?? ""),
      category: w.category ?? "其他",
      tags: (w.tags?.length ? w.tags : ["free"]) as PresetWorkflow["tags"],
      publishedAt: w.publishedAt ?? "",
      likes: w.likes ?? 0,
      downloads: w.downloads ?? 0,
      // 远程未填 dependencies 时回退本地同 id 工作流的依赖（服务端种子仅存元数据）
      dependencies: remoteDeps.map(toDependency),
      graph: (w.graph ?? local?.graph ?? null) as Record<string, unknown>,
      minVramGb: w.minVramGb ?? local?.minVramGb,
      gpuHint: (w.gpuHint as LocalizedText | undefined) ?? local?.gpuHint,
      thumbnail: w.thumbnail ?? local?.thumbnail ?? null,
    };
  });
  // 追加本地有、远程没有的工作流（本地新增尚未同步到远程数据库时仍可见）
  const remoteIds = new Set(remote.map((w) => w.id));
  for (const w of PRESET_WORKFLOWS) {
    if (!remoteIds.has(w.id)) merged.push(w);
  }
  return merged;
}

/** 远程优先，本地兜底：把远程 manifest 合并成客户端可直接消费的结构 */
export function buildManifestContent(remote: RemoteManifest | null): ManifestContent {
  const latestVersion =
    remote?.installer_latest_version ?? (localVersions as any).installer_latest_version ?? null;
  const downloads =
    remote?.installer_downloads ?? (localVersions as any).installer_downloads ?? [];
  const downloadUrl = downloads?.[0]?.url ?? null;

  return {
    contact: toContact(remote?.contact),
    models: toModels(remote?.models),
    workflows: toWorkflows(remote?.workflows),
    announcements: remote?.announcements ?? [],
    latestVersion,
    downloadUrl,
    source: remote ? "remote" : "local",
  };
}

/** 简单的语义化版本比较：返回 b 是否大于 a */
export function isNewerVersion(current: string, latest: string | null): boolean {
  if (!latest) return false;
  const a = String(current).split(".").map((n) => parseInt(n, 10) || 0);
  const b = String(latest).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (bv > av) return true;
    if (bv < av) return false;
  }
  return false;
}
