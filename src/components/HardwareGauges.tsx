import { CircularGauge } from "./CircularGauge";
import type { GpuInfo, SystemInfo } from "../store/types";
import { useT } from "../lib/i18n";

function fmtGb(mb: number): string {
  if (!mb) return "0";
  const gb = mb / 1024;
  return gb >= 10 ? String(Math.round(gb)) : gb.toFixed(1).replace(/\.0$/, "");
}

function fmtSize(mb: number): string {
  if (!mb) return "0G";
  const gb = mb / 1024;
  if (gb >= 1024) return `${(gb / 1024).toFixed(1).replace(/\.0$/, "")}T`;
  return gb >= 10 ? `${Math.round(gb)}G` : `${gb.toFixed(1).replace(/\.0$/, "")}G`;
}

export function HardwareGauges({
  gpuInfo,
  systemInfo,
}: {
  gpuInfo: GpuInfo | null;
  systemInfo: SystemInfo | null;
}) {
  const t = useT();
  const vramTotal = gpuInfo?.vram_total_mb ?? 0;
  const vramUsed = gpuInfo?.vram_used_mb ?? 0;
  const vramPct = vramTotal > 0 ? Math.round((vramUsed / vramTotal) * 100) : 0;

  const ramTotal = systemInfo?.ram_total_mb ?? (systemInfo?.ram_total_gb ?? 0) * 1024;
  const ramAvail = systemInfo?.ram_available_mb ?? (systemInfo?.ram_available_gb ?? 0) * 1024;
  const ramUsed = ramTotal > 0 ? Math.max(0, ramTotal - ramAvail) : 0;
  const ramPct = ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0;

  const diskTotal = systemInfo?.disk_total_mb ?? 0;
  const diskAvail = systemInfo?.disk_available_mb ?? 0;
  const diskUsed = diskTotal > 0 ? Math.max(0, diskTotal - diskAvail) : 0;
  const diskPct = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;

  const brand = gpuInfo?.gpu_name?.split(/\s+/)[0] ?? "";

  const gpuTooltip = gpuInfo
    ? [
        `${t("gauge.model")}: ${gpuInfo.gpu_name}`,
        brand ? `${t("gauge.brand")}: ${brand}` : null,
        `${t("gauge.driver")}: ${gpuInfo.driver_version}`,
        vramTotal ? `${t("gauge.vram")}: ${fmtGb(vramUsed)} / ${fmtGb(vramTotal)} GB` : null,
        vramTotal ? `${t("gauge.usage")}: ${vramPct}%` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  const cpuTooltip = systemInfo
    ? [
        `${t("gauge.model")}: ${systemInfo.cpu_name}`,
        `${t("gauge.cores")}: ${systemInfo.cpu_cores}`,
        `${t("gauge.usage")}: ${systemInfo.cpu_usage_percent}%`,
      ].join("\n")
    : undefined;

  const ramTooltip = ramTotal
    ? [
        `${t("gauge.total")}: ${fmtGb(ramTotal)} GB`,
        `${t("gauge.used")}: ${fmtGb(ramUsed)} GB`,
        `${t("gauge.available")}: ${fmtGb(ramAvail)} GB`,
        `${t("gauge.usage")}: ${ramPct}%`,
      ].join("\n")
    : undefined;

  const diskTooltip = diskTotal
    ? [
        `${t("gauge.drive")}: ${systemInfo?.disk_name || "-"}`,
        `${t("gauge.total")}: ${fmtSize(diskTotal)}`,
        `${t("gauge.used")}: ${fmtSize(diskUsed)}`,
        `${t("gauge.free")}: ${fmtSize(diskAvail)}`,
        `${t("gauge.usage")}: ${diskPct}%`,
      ].join("\n")
    : undefined;

  return (
    <>
      <CircularGauge
        label={t("gauge.gpu")}
        pct={vramPct}
        sub={vramTotal ? `${fmtGb(vramUsed)} / ${fmtGb(vramTotal)} GB` : undefined}
        available={!!gpuInfo?.has_nvidia && vramTotal > 0}
        title={gpuTooltip}
      />
      <CircularGauge
        label="CPU"
        pct={systemInfo?.cpu_usage_percent ?? 0}
        available={!!systemInfo}
        title={cpuTooltip}
      />
      <CircularGauge
        label={t("gauge.ram")}
        pct={ramPct}
        sub={ramTotal ? `${fmtGb(ramUsed)} / ${fmtGb(ramTotal)} GB` : undefined}
        available={ramTotal > 0}
        title={ramTooltip}
      />
      <CircularGauge
        label={t("gauge.disk")}
        pct={diskPct}
        sub={diskTotal ? `${fmtSize(diskUsed)} / ${fmtSize(diskTotal)}` : undefined}
        available={diskTotal > 0}
        title={diskTooltip}
      />
    </>
  );
}
