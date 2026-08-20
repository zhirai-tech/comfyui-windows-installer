import { ArrowLeft, ExternalLink, Globe } from "lucide-react";
import { useInstallerStore } from "../store/installerStore";
import { useState } from "react";
import { ContactModal } from "../components/ContactModal";
import { CONTACT_CHANNELS } from "../lib/contact";
import { useT } from "../lib/i18n";

const BRAND = {
  name: "ComfyUI Installer",
  slogan: "Open-source reference implementation for ComfyUI deployment",
  website: "https://github.com/zhirai-tech/comfyui-installer",
};

export default function Settings() {
  const t = useT();
  const go = useInstallerStore((s) => s.go);
  const versionsConfig = useInstallerStore((s) => s.versionsConfig);
  const remoteContact = useInstallerStore((s) => s.manifestContent?.contact);
  const [contactOpen, setContactOpen] = useState(false);

  const channels = remoteContact?.length ? remoteContact : CONTACT_CHANNELS;
  const primary = channels[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => go("welcome")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border dark:border-slate-700 dark:hover:border-slate-500 dark:text-slate-300 dark:hover:text-white border-slate-400 hover:border-slate-600 text-slate-800 hover:text-slate-900 transition bg-white/80 dark:bg-transparent text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> {t("common.back")}
        </button>
        <h2 className="text-xl font-semibold dark:text-slate-100 text-slate-900">
          {t("settings.title")}
        </h2>
      </div>

      <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold dark:text-slate-100 text-slate-900 mb-1">
            {t("settings.versionConfig")}
          </div>
          <div className="text-xs dark:text-slate-400 text-slate-600 leading-relaxed">
            {t("settings.versionDesc")}
          </div>
        </div>
        <pre className="log-box max-h-80 overflow-auto rounded-xl dark:bg-black/50 bg-slate-100 p-4 text-[11px] dark:text-slate-300 text-slate-700 border dark:border-slate-800 border-slate-200">
{JSON.stringify(versionsConfig ?? { [t("settings.notLoaded")]: true }, null, 2)}
        </pre>
      </div>

      <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-5 space-y-3 text-sm dark:text-slate-300 text-slate-700 leading-relaxed">
        <div className="font-semibold dark:text-slate-100 text-slate-900">
          {t("settings.planTitle")}
        </div>
        <ul className="list-disc pl-5 space-y-1 dark:text-slate-400 text-slate-600">
          <li>{t("settings.plan1")}</li>
          <li>{t("settings.plan2")}</li>
          <li>{t("settings.plan3")}</li>
          <li>{t("settings.plan4")}</li>
          <li>{t("settings.plan5")}</li>
          <li>{t("settings.plan6")}</li>
        </ul>
      </div>

      <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500/30 via-indigo-500/30 to-purple-500/30 ring-1 ring-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src="/logo.png"
              alt="Brand"
              className="w-[86%] h-[86%] object-contain drop-shadow-[0_0_6px_rgba(99,102,241,0.35)]"
            />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold dark:text-slate-100 text-slate-900">
              {BRAND.name}
            </div>
            <div className="text-[11px] dark:text-slate-400 text-slate-600">
              {BRAND.slogan}
            </div>
            <a
              href={BRAND.website}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] dark:text-brand-300 dark:hover:text-brand-200 text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline inline-flex items-center gap-1"
            >
              {BRAND.website.replace(/^https?:\/\//, "")}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium dark:text-slate-400 text-slate-600 uppercase tracking-wider">
            {t("settings.contact")}
          </div>
          <button
            onClick={() => setContactOpen(true)}
            className="w-full flex items-center gap-3 rounded-xl border dark:border-slate-700/80 dark:hover:border-indigo-400/60 border-slate-300 hover:border-indigo-400/60 dark:bg-slate-800/40 dark:hover:bg-indigo-500/5 bg-slate-100 hover:bg-indigo-50 transition p-3 text-left group"
          >
            <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0 shadow shadow-slate-500/30 ring-1 ring-slate-300/20">
              <Globe className="w-[20px] h-[20px] text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium dark:text-slate-100 text-slate-900">
                {t("settings.contactTitle")}
              </div>
              <div className="text-[11px] dark:text-slate-400 text-slate-600 truncate">
                {primary?.value ?? ""}
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 dark:text-slate-500 dark:group-hover:text-slate-300 text-slate-400 group-hover:text-slate-600 shrink-0" />
          </button>
        </div>

        <div className="pt-1 text-[11px] dark:text-slate-500 text-slate-500 text-right">
          {t("settings.copyright")}
        </div>
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
