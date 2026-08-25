import { useState } from "react";
import { BarChart3 } from "lucide-react";
import type { GpuInfo, DockerInfo, InstallMode } from "../store/installerStore";
import {
  phaseAtLeast,
  type DetectPhase,
  type PythonInfoLite,
  type SystemInfoLite,
} from "./DetectorBits";
import { HardwareSection } from "./HardwareSection";
import { DockerEnvSection, PythonEnvSection } from "./EnvSections";
import { RecommendationModal } from "./RecommendationModal";
import { useT } from "../lib/i18n";

interface Props {
  systemInfo?: SystemInfoLite | null;
  gpuInfo: GpuInfo | null;
  pythonInfo?: PythonInfoLite | null;
  dockerInfo?: DockerInfo | null;
  installMode?: InstallMode;
  detectPhase?: DetectPhase;
}

export default function GPUInfo({
  systemInfo,
  gpuInfo,
  pythonInfo,
  dockerInfo,
  installMode = "host",
  detectPhase = "idle",
}: Props) {
  const vram = gpuInfo?.vram_gb ?? 0;
  const [showRec, setShowRec] = useState(false);
  const t = useT();

  return (
    <div className="space-y-3">
      <HardwareSection
        systemInfo={systemInfo}
        gpuInfo={gpuInfo}
        vram={vram}
        detectPhase={detectPhase}
      />

      {installMode === "host" && (
        <PythonEnvSection pythonInfo={pythonInfo} detectPhase={detectPhase} />
      )}

      {installMode === "docker" && (
        <DockerEnvSection dockerInfo={dockerInfo} detectPhase={detectPhase} />
      )}

      {gpuInfo && phaseAtLeast(detectPhase, "gpu") && (
        <>
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setShowRec(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800/60 bg-white hover:bg-slate-500/5 text-[12.5px] font-bold dark:text-slate-200 text-slate-800 shadow-sm transition"
            >
              <BarChart3 className="w-4 h-4 text-brand-500 dark:text-brand-300" />
              {t("rec.open", { vram })}
            </button>
          </div>
          {showRec && <RecommendationModal vram={vram} onClose={() => setShowRec(false)} />}
        </>
      )}
    </div>
  );
}
