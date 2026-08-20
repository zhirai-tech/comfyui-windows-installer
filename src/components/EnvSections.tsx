import { Box, Boxes, CheckCircle2, Cpu, FolderGit2, Layers } from "lucide-react";
import type { DockerInfo } from "../store/installerStore";
import { CpuChipIcon, DockerIcon, GpuCardIcon } from "./BrandIcons";
import {
  DepChip,
  phaseAtLeast,
  Row,
  VersionBadge,
  type DetectPhase,
  type PythonInfoLite,
} from "./DetectorBits";
import { useT } from "../lib/i18n";

function envState(detectPhase: DetectPhase): "pending" | "loading" | "ok" {
  if (phaseAtLeast(detectPhase, "env")) return "ok";
  if (phaseAtLeast(detectPhase, "gpu")) return "loading";
  return "pending";
}

function envVal(detectPhase: DetectPhase, s: string, fallback = "…") {
  return phaseAtLeast(detectPhase, "env") ? s : fallback;
}

function chipState(detectPhase: DetectPhase, value: boolean | null | undefined) {
  return phaseAtLeast(detectPhase, "deps")
    ? (value ?? null)
    : phaseAtLeast(detectPhase, "env")
    ? "loading"
    : null;
}

export function PythonEnvSection({
  pythonInfo,
  detectPhase,
}: {
  pythonInfo?: PythonInfoLite | null;
  detectPhase: DetectPhase;
}) {
  const t = useT();
  const st = envState(detectPhase);
  return (
    <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-3.5 backdrop-blur shadow-sm">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="text-sm font-bold dark:text-slate-100 text-slate-900 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-brand-500 dark:text-brand-300" />
          {t("env.pythonTitle")}
        </div>
        <VersionBadge
          ok={
            !phaseAtLeast(detectPhase, "env")
              ? null
              : pythonInfo?.is_compatible === true
              ? true
              : pythonInfo?.is_compatible === false
              ? false
              : null
          }
          label={
            !phaseAtLeast(detectPhase, "env")
              ? t("env.detecting")
              : pythonInfo?.is_compatible === true
              ? t("env.compatible", { v: pythonInfo?.version ?? "" })
              : pythonInfo?.is_compatible === false
              ? t("env.incompatible")
              : t("env.waiting")
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y dark:divide-slate-800/60 divide-slate-200 md:divide-y-0">
        <div className="divide-y dark:divide-slate-800/60 divide-slate-200">
          <Row
            icon={<Layers className="w-4 h-4" />}
            label={t("env.pythonVersion")}
            value={
              <span>
                {envVal(detectPhase, `CPython ${pythonInfo?.version ?? ""} · 64-bit PGO`, t("env.waitingPython"))}
              </span>
            }
            state={st}
          />
        </div>
        <div className="divide-y dark:divide-slate-800/60 divide-slate-200 md:border-l dark:md:border-slate-800/60 md:border-slate-200 md:pl-6">
          <Row
            icon={<Box className="w-4 h-4" />}
            label={t("env.exePath")}
            value={
              <span className="font-mono text-[12px]">
                {envVal(detectPhase, pythonInfo?.executable ?? "", t("env.waitingPath"))}
              </span>
            }
            state={st}
          />
        </div>
      </div>

      <div className="pt-2.5 mt-2 border-t dark:border-slate-800/60 border-slate-200">
        <div className="text-[10px] uppercase tracking-wider dark:text-slate-500 text-slate-600 font-semibold mb-2">
          {t("env.selfCheck")}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          <DepChip state={chipState(detectPhase, pythonInfo?.pip_ok)} transitionDelay="0ms" icon={<Box className="w-3.5 h-3.5" />} label={t("env.pip")} />
          <DepChip state={chipState(detectPhase, pythonInfo?.git_ok)} transitionDelay="80ms" icon={<FolderGit2 className="w-3.5 h-3.5" />} label={t("env.git")} />
          <DepChip state={chipState(detectPhase, pythonInfo?.node_ok)} transitionDelay="160ms" icon={<Boxes className="w-3.5 h-3.5" />} label={t("env.node")} />
          <DepChip state={chipState(detectPhase, pythonInfo?.virtualenv_ok)} transitionDelay="240ms" icon={<Layers className="w-3.5 h-3.5" />} label={t("env.venv")} />
          <DepChip state={chipState(detectPhase, pythonInfo?.visual_cpp_ok)} transitionDelay="320ms" icon={<Cpu className="w-3.5 h-3.5" />} label={t("env.vcpp")} />
        </div>
      </div>
    </div>
  );
}

export function DockerEnvSection({
  dockerInfo,
  detectPhase,
}: {
  dockerInfo?: DockerInfo | null;
  detectPhase: DetectPhase;
}) {
  const t = useT();
  const st = envState(detectPhase);
  return (
    <div className="rounded-2xl border dark:border-slate-800 border-slate-300 dark:bg-slate-900/60 bg-white/95 p-3.5 backdrop-blur shadow-sm">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="text-sm font-bold dark:text-slate-100 text-slate-900 flex items-center gap-2">
          <DockerIcon className="w-4 h-4" />
          {t("env.dockerTitle")}
        </div>
        <VersionBadge
          ok={
            !phaseAtLeast(detectPhase, "env")
              ? null
              : dockerInfo?.running === true
              ? true
              : dockerInfo?.running === false
              ? false
              : null
          }
          label={
            !phaseAtLeast(detectPhase, "env")
              ? t("env.dockerDetecting")
              : dockerInfo?.running === true
              ? t("env.dockerRunning")
              : dockerInfo?.running === false
              ? t("env.dockerStopped")
              : t("env.waiting")
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y dark:divide-slate-800/60 divide-slate-200 md:divide-y-0">
        <div className="divide-y dark:divide-slate-800/60 divide-slate-200">
          <Row
            icon={<Boxes className="w-4 h-4" />}
            label={t("env.dockerVersion")}
            value={
              <span>
                {envVal(detectPhase, `Desktop ${dockerInfo?.version ?? ""} · Compose ${dockerInfo?.compose_version ?? ""}`, t("env.waitingDocker"))}
              </span>
            }
            state={st}
          />
        </div>
        <div className="divide-y dark:divide-slate-800/60 divide-slate-200 md:border-l dark:md:border-slate-800/60 md:border-slate-200 md:pl-6">
          <Row
            icon={<Box className="w-4 h-4" />}
            label={t("env.wsl")}
            value={
              <span>
                {envVal(
                  detectPhase,
                  `${
                    dockerInfo?.wsl2_enabled === true
                      ? t("env.wslEnabled")
                      : dockerInfo?.wsl2_enabled === false
                      ? t("env.wslDisabled")
                      : ""
                  }${
                    dockerInfo?.wsl2_enabled !== undefined ||
                    dockerInfo?.nvidia_container_ok !== undefined
                      ? " · "
                      : ""
                  }${
                    dockerInfo?.nvidia_container_ok === true
                      ? t("env.nvidiaOk")
                      : dockerInfo?.nvidia_container_ok === false
                      ? t("env.nvidiaNo")
                      : ""
                  }`,
                  t("env.waitingWsl")
                )}
              </span>
            }
            state={st}
          />
        </div>
      </div>

      <div className="pt-2.5 mt-2 border-t dark:border-slate-800/60 border-slate-200">
        <div className="text-[10px] uppercase tracking-wider dark:text-slate-500 text-slate-600 font-semibold mb-2">
          {t("env.dockerCheck")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <DepChip state={chipState(detectPhase, dockerInfo?.wsl2_enabled)} transitionDelay="0ms" icon={<CpuChipIcon className="w-3.5 h-3.5" />} label={t("env.wslEnabled2")} />
          <DepChip state={chipState(detectPhase, dockerInfo?.nvidia_container_ok)} transitionDelay="120ms" icon={<GpuCardIcon className="w-3.5 h-3.5" />} label={t("env.nvidiaContainer")} />
          <DepChip
            state={chipState(detectPhase, dockerInfo?.missing_requirements !== undefined ? (dockerInfo.missing_requirements.length === 0) : null)}
            transitionDelay="240ms"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label={t("env.noMissing")}
          />
        </div>
      </div>
    </div>
  );
}
