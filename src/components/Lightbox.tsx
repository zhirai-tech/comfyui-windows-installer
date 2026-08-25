import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLightboxStore } from "../store/lightboxStore";
import { useT } from "../lib/i18n";

// 判断封面是否视频（Civitai 视频预览为 .mp4/.webm/.mov 等）
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

// 通用大图/视频弹窗：点击卡片封面后打开，图片支持滚轮缩放、拖拽平移、双击复位。
// 同一时间只允许一个打开（通过 useLightboxStore 的全局 openId 区分）。
export function Lightbox({ id, url }: { id: string; url: string }) {
  const openId = useLightboxStore((s) => s.openId);
  const open = openId === id;
  if (!open) return null;
  return <LightboxOverlay url={url} />;
}

function LightboxOverlay({ url }: { url: string }) {
  const t = useT();
  const setOpenId = useLightboxStore((s) => s.setOpenId);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const zoomRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const video = isVideoUrl(url);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // 阻止背景滚轮滚动
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // 图片滚轮缩放
  useEffect(() => {
    if (video) return;
    const el = zoomRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const ns = Math.min(12, Math.max(0.5, scaleRef.current * factor));
      scaleRef.current = ns;
      setScale(ns);
      if (ns <= 1) setPos({ x: 0, y: 0 });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [video]);

  // 拖拽平移
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.dragging) return;
      setPos({ x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const close = () => setOpenId(null);
  const resetZoom = () => {
    scaleRef.current = 1;
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
      onClick={close}
    >
      <button
        type="button"
        onClick={close}
        title={t("common.close")}
        className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
      >
        <X className="w-5 h-5" />
      </button>
      {video ? (
        <video
          src={url}
          controls
          autoPlay
          muted
          loop
          playsInline
          className="max-w-[92vw] max-h-[88vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          ref={zoomRef}
          className="flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={resetZoom}
          onMouseDown={(e) => {
            if (scale <= 1) return;
            dragRef.current = {
              dragging: true,
              startX: e.clientX,
              startY: e.clientY,
              baseX: pos.x,
              baseY: pos.y,
            };
          }}
        >
          <img
            src={url}
            alt=""
            draggable={false}
            className="max-w-[92vw] max-h-[88vh] object-contain block"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
          />
        </div>
      )}
    </div>,
    document.body
  );
}
