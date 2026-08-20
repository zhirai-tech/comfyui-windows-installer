import { Gauge, HardDrive, MonitorSpeaker, Boxes } from "lucide-react";
import type { GpuInfo } from "../store/installerStore";
import { CpuChipIcon, GpuCardIcon } from "./BrandIcons";
import { phaseAtLeast, Row, type DetectPhase, type SystemInfoLite } from "./DetectorBits";
import { useT } from "../lib/i18n";

export function HardwareSection({
  systemInfo,
  gpuInfo,
  vram,
  detectPhase,
}: {
  systemInfo?: SystemInfoLite | null;
  gpuInfo: GpuInfo | null;
  vram: number;
  detectPhase: DetectPhase;
}) {
  const t = useT();
  const sysState: any = phaseAtLeast(detectPhase, "system") ? "ok" : "loading";
  const gpuState: any = phaseAtLeast(detectPhase, "gpu") ? "ok" : sysState;
  const sysVal = (s: string, fallback = t("hw.detecting")) =>
    phaseAtLeast(detectPhase, "system") ? s : fallback;
  const gpuVal = (s: string, fallback = t("hw.detecting")) =>
    phaseAtLeast(detectPhase, "gpu") ? s : fallback;

  return (
    <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-3.5 backdrop-blur shadow-sm">
      <div className="text-sm font-bold dark:text-slate-100 text-slate-900 mb-2">
        {t("hw.title")}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y dark:divide-slate-800/60 divide-slate-200 md:divide-y-0">
        <div className="divide-y dark:divide-slate-800/60 divide-slate-200">
          <Row
            icon={<HardDrive className="w-4 h-4" />}
            label={t("hw.system")}
            value={
              <span>
                {sysVal(
                  `${systemInfo?.os_name ?? ""}${
                    systemInfo?.os_arch ? `（${systemInfo.os_arch}）` : ""
                  }`,
                  t("hw.waitingSystem")
                )}
              </span>
            }
            state={sysState}
          />
          <Row
            icon={<CpuChipIcon className="w-4 h-4" />}
            label={t("hw.cpu")}
            value={
              <span>
                {sysVal(
                  `${systemInfo?.cpu_name ?? ""} · ${t("hw.cores", { n: systemInfo?.cpu_cores ?? 0 })}`,
                  t("hw.waitingCpu")
                )}
              </span>
            }
            state={sysState}
          />
          <Row
            icon={<Gauge className="w-4 h-4" />}
            label={t("hw.ram")}
            value={
              <span>
                {sysVal(`${systemInfo?.ram_total_gb ?? 0} GB`, t("hw.waitingRam"))}
              </span>
            }
            state={sysState}
          />
        </div>

        <div className="divide-y dark:divide-slate-800/60 divide-slate-200">
          <Row
            icon={<MonitorSpeaker className="w-4 h-4" />}
            label={t("hw.gpu")}
            value={
              <span>
                {gpuVal(`${gpuInfo?.gpu_name ?? ""} · ${vram} GB`, t("hw.waitingGpu"))}
              </span>
            }
            state={gpuInfo?.has_nvidia || phaseAtLeast(detectPhase, "gpu") ? gpuState : "bad"}
          />
          <Row
            icon={<GpuCardIcon className="w-4 h-4" />}
            label={t("hw.driver")}
            value={
              <span>
                {gpuVal(
                  `Driver ${gpuInfo?.driver_version ?? ""} · CUDA ${gpuInfo?.cuda_version ?? ""}`,
                  t("hw.waitingDriver")
                )}
              </span>
            }
            state={gpuState}
          />
          <Row
            icon={<Boxes className="w-4 h-4" />}
            label={t("hw.vram")}
            value={
              <span>
                {gpuVal(
                  `${vram} GB GDDR6X · ${vram >= 24 ? t("hw.bus", { n: 384 }) : vram >= 12 ? t("hw.bus", { n: 192 }) : vram >= 8 ? t("hw.bus", { n: 128 }) : ""}`,
                  t("hw.waitingVram")
                )}
              </span>
            }
            state={gpuState}
          />
        </div>
      </div>
    </div>
  );
}
