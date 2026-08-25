import { useEffect } from "react";
import { useInstallerStore } from "../store/installerStore";
import { HardwareGauges } from "./HardwareGauges";
import { isTauri } from "../lib/env";
import { invoke } from "../lib/rpc";

/** 顶部固定硬件条：GPU / CPU / 内存 / 磁盘 四个环形仪表盘 + UI 版本号 + GPU 驱动版本 */
export function HardwareBar() {
  const gpuInfo = useInstallerStore((s) => s.gpuInfo);
  const systemInfo = useInstallerStore((s) => s.systemInfo);
  const setGpuInfo = useInstallerStore((s) => s.setGpuInfo);
  const setSystemInfo = useInstallerStore((s) => s.setSystemInfo);
  const installDir = useInstallerStore((s) => s.installDir);
  const appVersion = useInstallerStore((s) => s.appVersion);

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      if (!gpuInfo) {
        try {
          const g: any = await invoke("detect_gpu");
          if (g?.gpu_name || g?.has_nvidia !== undefined) setGpuInfo(g);
        } catch {}
      }
      if (!systemInfo) {
        try {
          const s: any = await invoke("detect_system", { installDir });
          if (s) setSystemInfo(s);
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-4 flex-wrap rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/70 bg-white/95 backdrop-blur px-4 py-2">
      <div className="flex items-center gap-3">
        <HardwareGauges gpuInfo={gpuInfo} systemInfo={systemInfo} />
      </div>

      <div className="w-px h-8 bg-slate-300 dark:bg-slate-700" />

      <div className="flex items-center gap-2 text-[11px] leading-tight dark:text-slate-300 text-slate-600 shrink-0">
        <span className="font-mono whitespace-nowrap">UI v{appVersion || "0.1.0"}</span>
        <span className="text-slate-400 dark:text-slate-600">·</span>
        <span className="whitespace-nowrap" title={gpuInfo?.driver_version || ""}>
          {gpuInfo?.driver_version ? `驱动 ${gpuInfo.driver_version}` : "驱动 —"}
        </span>
      </div>
    </div>
  );
}
