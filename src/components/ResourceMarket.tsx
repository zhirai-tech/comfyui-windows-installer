import { useEffect, useMemo, useState } from "react";
import { Bot, Database, Download, ExternalLink, Loader2, Plug, Puzzle, Rocket, Search, Zap, type LucideIcon } from "lucide-react";
import { fetchResources, type ResourceItem } from "../lib/resources";
import { useT, useI18n } from "../lib/i18n";
import { useMarketInstall, INSTALLABLE_TYPES } from "../hooks/useMarketInstall";
import { ThumbCard } from "./ThumbCard";

const PAGE_SIZE = 200;

// 无封面类型的小图标（agent/skill/node/plugin/dataset），模型走媒体卡片
const TYPE_ICONS: Record<string, LucideIcon> = {
  agent: Bot,
  skill: Zap,
  node: Puzzle,
  plugin: Plug,
  dataset: Database,
  project: Rocket,
};

const SOURCES = [
  { key: "all", labelKey: "res.source.all" },
  { key: "huggingface", labelKey: "res.source.huggingface" },
  { key: "civitai", labelKey: "res.source.civitai" },
  { key: "github", labelKey: "res.source.github" },
];

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// 截断说明到 n 个字符，超出加省略号
function clipText(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function daysAgo(iso: string | null) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86400000;
}

const selectCls =
  "rounded-full border dark:border-slate-700 border-slate-300 dark:bg-slate-900/60 bg-white px-2.5 py-1.5 text-[12px] dark:text-slate-200 text-slate-700 outline-none focus:border-brand-500";

export function ResourceMarket({ type }: { type: string }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);

  const [items, setItems] = useState<ResourceItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [recent, setRecent] = useState("all");
  const [quantized, setQuantized] = useState("");
  const [chinese, setChinese] = useState("");

  const { view, download, install } = useMarketInstall();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchResources(type, 0, PAGE_SIZE).then((page) => {
      if (!alive) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [type]);

  const loadMore = async () => {
    if (nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    const page = await fetchResources(type, nextCursor, PAGE_SIZE);
    setItems((prev) => [...prev, ...page.items]);
    setNextCursor(page.nextCursor);
    setLoadingMore(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (source !== "all" && r.source !== source) return false;
      if (recent !== "all") {
        const d = daysAgo(r.updatedAt || r.publishedAt);
        if (recent === "7d" && d > 7) return false;
        if (recent === "30d" && d > 30) return false;
      }
      if (quantized === "yes" && !r.filters.quantized) return false;
      if (quantized === "no" && r.filters.quantized) return false;
      if (chinese === "yes" && !r.filters.chinese) return false;
      if (chinese === "no" && r.filters.chinese) return false;
      if (q) {
        const hay = [r.name, r.nameZh, r.description, r.descriptionZh, r.author, ...(r.tags || [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, source, recent, quantized, chinese]);

  const isModel = type === "model";
  const TypeIcon = TYPE_ICONS[type];

  // 下载 / 一键安装按钮（卡片与列表共用）
  const renderActions = (r: ResourceItem) => (
    <>
      <button
        onClick={() => download(r)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-white text-[11px] font-bold transition"
      >
        <Download className="w-3 h-3" />
        {t("mk.download")}
      </button>
      {INSTALLABLE_TYPES.has(type) && (
        <button
          onClick={() => install({ id: r.id, type, name: r.name, description: r.description, externalUrl: r.externalUrl })}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-500 hover:bg-brand-400 text-white text-[11px] font-bold transition"
        >
          <Zap className="w-3 h-3" />
          {t("mk.install")}
        </button>
      )}
    </>
  );

  // 卡片下方信息区：名称 / 来源 / 简介 / 元数据 / 操作按钮（模型与有图卡片共用）
  const renderCardBody = (r: ResourceItem, name: string, desc: string | null) => {
    const m = r.metrics;
    const updated = r.updatedAt || r.publishedAt;
    return (
      <div className="px-3 py-2.5 flex-1 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[12.5px] font-semibold dark:text-slate-100 text-slate-800 truncate" title={name}>
            {name}
          </span>
          {r.externalUrl && (
            <button
              onClick={() => view(r)}
              title={t("res.viewSource")}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-600 hover:text-brand-500 dark:hover:text-brand-300 transition flex-shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="self-start px-1.5 py-0.5 rounded text-[9.5px] font-bold leading-none bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
          {t(`res.source.${r.source}`)}
        </span>
        {desc && (
          <div className="text-[11.5px] leading-relaxed dark:text-slate-400 text-slate-600 line-clamp-2">{desc}</div>
        )}
        <div className="mt-auto pt-1.5 flex items-center gap-2.5 text-[10.5px] dark:text-slate-500 text-slate-500 flex-wrap">
          {r.author && <span className="truncate max-w-[120px]">{r.author}</span>}
          <span className="inline-flex items-center gap-1">
            <Download className="w-3 h-3" />
            {formatCount(m.downloads ?? 0)}
          </span>
          <span className="inline-flex items-center gap-1">{formatCount(m.likes ?? 0)}</span>
          {updated && <span>{updated.slice(0, 10)}</span>}
        </div>
        <div className="mt-auto pt-1.5 flex items-center gap-1.5">{renderActions(r)}</div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px] rounded-full border dark:border-slate-700 border-slate-300 dark:bg-slate-900/60 bg-white px-3 py-1.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("res.search")}
            className="flex-1 min-w-0 bg-transparent text-[12px] dark:text-slate-100 text-slate-900 outline-none"
          />
        </div>

        <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
          {SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {t(s.labelKey)}
            </option>
          ))}
        </select>

        <select value={recent} onChange={(e) => setRecent(e.target.value)} className={selectCls}>
          <option value="all">{t("res.recent.all")}</option>
          <option value="7d">{t("res.recent.7d")}</option>
          <option value="30d">{t("res.recent.30d")}</option>
        </select>

        {isModel && (
          <>
            <select value={quantized} onChange={(e) => setQuantized(e.target.value)} className={selectCls}>
              <option value="">{t("res.quantized")}</option>
              <option value="yes">{t("res.yes")}</option>
              <option value="no">{t("res.no")}</option>
            </select>
            <select value={chinese} onChange={(e) => setChinese(e.target.value)} className={selectCls}>
              <option value="">{t("res.chinese")}</option>
              <option value="yes">{t("res.yes")}</option>
              <option value="no">{t("res.no")}</option>
            </select>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] dark:text-slate-400 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("res.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-[12px] dark:text-slate-500 text-slate-500">{t("res.empty")}</div>
        ) : (
          isModel ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-2">
              {filtered.map((r) => {
                const name = lang === "zh" && r.nameZh ? r.nameZh : r.name;
                const desc = lang === "zh" && r.descriptionZh ? r.descriptionZh : r.description;
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 overflow-hidden flex flex-col"
                  >
                    <ThumbCard
                      id={r.id}
                      thumbnail={r.thumbnail}
                      onUploaded={(url) =>
                        setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, thumbnail: url } : x)))
                      }
                    />
                    {renderCardBody(r, name, desc)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-2">
              {filtered.map((r) => {
                const name = lang === "zh" && r.nameZh ? r.nameZh : r.name;
                const desc = lang === "zh" && r.descriptionZh ? r.descriptionZh : r.description;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3 py-2.5"
                  >
                    {TypeIcon && <TypeIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[12.5px] font-semibold dark:text-slate-100 text-slate-800 truncate"
                          title={name}
                        >
                          {name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold leading-none bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                          {t(`res.source.${r.source}`)}
                        </span>
                      </div>
                      <p className="text-[11.5px] dark:text-slate-400 text-slate-600 truncate">
                        {clipText(desc, 140) || name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.externalUrl && (
                        <button
                          onClick={() => view(r)}
                          title={t("res.viewSource")}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-600 hover:text-brand-500 dark:hover:text-brand-300 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {renderActions(r)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
          )}
      </div>

      {nextCursor != null && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-700 dark:hover:border-slate-500 hover:border-slate-500 px-4 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 self-center"
        >
          {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {t("res.loadMore")}
        </button>
      )}
    </div>
  );
}
