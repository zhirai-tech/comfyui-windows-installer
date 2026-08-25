import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, Video } from "lucide-react";
import { resolveThumbUrl, uploadThumbnail } from "../lib/resources";
import { useT } from "../lib/i18n";
import { useLightboxStore } from "../store/lightboxStore";
import { isVideoUrl, Lightbox } from "./Lightbox";

// 卡片封面：有图展示图，有视频可播放，无则用 logo 占位；右上角支持上传截图。
export function ThumbCard({
  id,
  thumbnail,
  onUploaded,
  className = "",
  acceptVideo = false,
  upload = uploadThumbnail,
}: {
  id: string;
  thumbnail: string | null;
  onUploaded?: (url: string) => void;
  className?: string;
  acceptVideo?: boolean;
  upload?: (id: string, file: File) => Promise<string | null>;
}) {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const setOpenId = useLightboxStore((s) => s.setOpenId);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = resolveThumbUrl(thumbnail);
  const video = url ? isVideoUrl(url) : false;

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const newUrl = await upload(id, file);
    setUploading(false);
    if (newUrl) onUploaded?.(newUrl);
  };

  return (
    <>
      <div
        className={`relative w-full aspect-[4/5] overflow-hidden bg-slate-200/60 dark:bg-slate-900 ${className}`}
      >
        {url ? (
          <button
            type="button"
            onClick={() => setOpenId(id)}
            className="w-full h-full block p-0 bg-transparent border-0 cursor-zoom-in"
            title={t("res.zoomHint")}
          >
            {video ? (
              <video
                src={url}
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
                onMouseEnter={(e) => {
                  const v = e.currentTarget;
                  v.currentTime = 0;
                  v.play().catch(() => {});
                }}
                onMouseLeave={(e) => e.currentTarget.pause()}
              />
            ) : (
              <img src={url} alt="" loading="lazy" className="w-full h-full object-contain" />
            )}
          </button>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
            <img src="/logo-mark.png" alt="" className="w-[80%] max-h-[70%] opacity-80 object-contain" />
            <span className="text-[11px] text-slate-600 dark:text-white">{t("res.thumbFallback")}</span>
          </div>
        )}

        {video && (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/40 text-white pointer-events-none">
            <Video className="w-3.5 h-3.5" />
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptVideo ? "image/*,video/*" : "image/*"}
          className="hidden"
          onChange={onChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title={t("res.uploadThumb")}
          className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white transition disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <Lightbox id={id} url={url ?? ""} />
    </>
  );
}
