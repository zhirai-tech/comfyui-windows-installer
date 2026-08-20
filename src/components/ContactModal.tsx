import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, X } from "lucide-react";
import { CONTACT_CHANNELS, ContactChannel } from "../lib/contact";
import { useInstallerStore } from "../store/installerStore";
import { openExternal } from "../lib/window";
import { useT, useLocalize } from "../lib/i18n";

function ChannelIcon() {
  return (
    <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center shrink-0">
      <Mail className="w-3.5 h-3.5 text-white" />
    </span>
  );
}

function Preview({ item }: { item: ContactChannel }) {
  const t = useT();
  const L = useLocalize();
  const [err, setErr] = useState(false);
  const src = item.qrImage || "/logo.png";

  if (err) {
    return (
      <div className="w-32 h-32 rounded-xl border border-dashed dark:border-slate-600 border-slate-300 flex items-center justify-center text-center text-[10px] dark:text-slate-500 text-slate-500 px-2 leading-relaxed">
        {t("contact.placeholder")}
      </div>
    );
  }

  return (
    <img
      key={item.id}
      src={src}
      alt={L(item.label)}
      onError={() => setErr(true)}
      className="w-32 h-32 object-contain rounded-xl border dark:border-slate-700 border-slate-200 bg-white p-1"
    />
  );
}

export function ContactModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const L = useLocalize();
  const remoteContact = useInstallerStore((s) => s.manifestContent?.contact);
  const channels = remoteContact?.length ? remoteContact : CONTACT_CHANNELS;

  const [selectedId, setSelectedId] = useState(channels[0].id);
  const [copied, setCopied] = useState(false);

  const selected = channels.find((c) => c.id === selectedId) ?? channels[0];
  const hasQr = !!selected.qrImage;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 dark:bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-slate-800 border-slate-200 flex items-start justify-between gap-3">
          <div className="text-base font-bold dark:text-slate-100 text-slate-900">{t("contact.title")}</div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-500/10 transition dark:text-slate-400 text-slate-600"
            title={t("common.close")}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 二维码 / Logo 预览区 */}
          <div className="flex flex-col items-center gap-2">
            <Preview item={selected} />
            <div className="text-[12px] font-semibold dark:text-slate-100 text-slate-800">
              {L(selected.label)}
            </div>
            <div className="text-[11px] dark:text-slate-400 text-slate-600">
              {hasQr ? t("contact.scan") : t("contact.logo")}
            </div>
          </div>

          {/* 通道选择 */}
          <div className="flex flex-wrap justify-center gap-2">
            {channels.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition " +
                    (active
                      ? "dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 bg-slate-900 text-white border-slate-900"
                      : "dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-300 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900")
                  }
                >
                  <ChannelIcon />
                  <span>{L(c.label)}</span>
                </button>
              );
            })}
          </div>

          {/* 当前选中通道的操作 */}
          <div className="flex items-center gap-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold dark:text-slate-100 text-slate-800">{L(selected.label)}</div>
              <div className="mt-0.5 text-[11px] dark:text-slate-400 text-slate-600 truncate">{selected.value}</div>
            </div>
            <button
              onClick={() => copy(selected.value)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 text-[11px] font-semibold transition shrink-0"
              title={t("common.copy")}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? t("common.copied") : t("common.copy")}
            </button>
            {selected.url && (
              <button
                onClick={() => void openExternal(selected.url!)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border dark:border-slate-600 dark:hover:border-slate-400 dark:text-slate-200 dark:hover:text-white border-slate-300 hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:bg-slate-800/60 bg-white/80 transition shrink-0"
                title={selected.hint ? L(selected.hint) : t("common.open")}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t dark:border-slate-800 border-slate-200 bg-slate-500/5">
          <div className="text-[10.5px] dark:text-slate-500 text-slate-600">
            {t("contact.footer")}
          </div>
        </div>
      </div>
    </div>
  );
}
