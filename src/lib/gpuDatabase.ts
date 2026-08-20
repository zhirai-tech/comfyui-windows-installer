// 主流 NVIDIA 显卡数据库：用于把 nvidia-smi 返回的原始型号名规范化，
// 并给出该型号的标准显存规格，作为检测值的兜底与话术展示依据。

export interface GpuLookup {
  /** 规范短型号名，如 "RTX 2060" */
  name: string;
  /** 标准显存（GB） */
  vramGb: number;
}

interface GpuDbEntry extends GpuLookup {
  /** 匹配关键词，放在前面的优先级更高（更具体） */
  keywords: string[];
}

const GPU_DATABASE: GpuDbEntry[] = [
  // RTX 50 系
  { keywords: ["5090"], name: "RTX 5090", vramGb: 32 },
  { keywords: ["5080"], name: "RTX 5080", vramGb: 16 },
  { keywords: ["5070 ti", "5070ti"], name: "RTX 5070 Ti", vramGb: 16 },
  { keywords: ["5070"], name: "RTX 5070", vramGb: 12 },
  { keywords: ["5060 ti", "5060ti"], name: "RTX 5060 Ti", vramGb: 16 },
  { keywords: ["5060"], name: "RTX 5060", vramGb: 8 },
  // RTX 40 系
  { keywords: ["4090"], name: "RTX 4090", vramGb: 24 },
  { keywords: ["4080 super", "4080s"], name: "RTX 4080 Super", vramGb: 16 },
  { keywords: ["4080"], name: "RTX 4080", vramGb: 16 },
  { keywords: ["4070 ti super", "4070ti super"], name: "RTX 4070 Ti Super", vramGb: 16 },
  { keywords: ["4070 ti", "4070ti"], name: "RTX 4070 Ti", vramGb: 12 },
  { keywords: ["4070 super", "4070s"], name: "RTX 4070 Super", vramGb: 12 },
  { keywords: ["4070"], name: "RTX 4070", vramGb: 12 },
  { keywords: ["4060 ti", "4060ti"], name: "RTX 4060 Ti", vramGb: 8 },
  { keywords: ["4060"], name: "RTX 4060", vramGb: 8 },
  // RTX 30 系
  { keywords: ["3090 ti", "3090ti"], name: "RTX 3090 Ti", vramGb: 24 },
  { keywords: ["3090"], name: "RTX 3090", vramGb: 24 },
  { keywords: ["3080 ti", "3080ti"], name: "RTX 3080 Ti", vramGb: 12 },
  { keywords: ["3080"], name: "RTX 3080", vramGb: 10 },
  { keywords: ["3070 ti", "3070ti"], name: "RTX 3070 Ti", vramGb: 8 },
  { keywords: ["3070"], name: "RTX 3070", vramGb: 8 },
  { keywords: ["3060 ti", "3060ti"], name: "RTX 3060 Ti", vramGb: 8 },
  { keywords: ["3060"], name: "RTX 3060", vramGb: 12 },
  // RTX 20 系
  { keywords: ["2080 ti", "2080ti"], name: "RTX 2080 Ti", vramGb: 11 },
  { keywords: ["2080 super", "2080s"], name: "RTX 2080 Super", vramGb: 8 },
  { keywords: ["2080"], name: "RTX 2080", vramGb: 8 },
  { keywords: ["2070 super", "2070s"], name: "RTX 2070 Super", vramGb: 8 },
  { keywords: ["2070"], name: "RTX 2070", vramGb: 8 },
  { keywords: ["2060 super", "2060s"], name: "RTX 2060 Super", vramGb: 8 },
  { keywords: ["2060"], name: "RTX 2060", vramGb: 6 },
  // GTX 16 系
  { keywords: ["1660 ti", "1660ti"], name: "GTX 1660 Ti", vramGb: 6 },
  { keywords: ["1660 super", "1660s"], name: "GTX 1660 Super", vramGb: 6 },
  { keywords: ["1660"], name: "GTX 1660", vramGb: 6 },
  { keywords: ["1650 super", "1650s"], name: "GTX 1650 Super", vramGb: 4 },
  { keywords: ["1650"], name: "GTX 1650", vramGb: 4 },
  // GTX 10 系
  { keywords: ["1080 ti", "1080ti"], name: "GTX 1080 Ti", vramGb: 11 },
  { keywords: ["1080"], name: "GTX 1080", vramGb: 8 },
  { keywords: ["1070 ti", "1070ti"], name: "GTX 1070 Ti", vramGb: 8 },
  { keywords: ["1070"], name: "GTX 1070", vramGb: 8 },
  { keywords: ["1060"], name: "GTX 1060", vramGb: 6 },
  { keywords: ["1050 ti", "1050ti"], name: "GTX 1050 Ti", vramGb: 4 },
  { keywords: ["1050"], name: "GTX 1050", vramGb: 2 },
];

/**
 * 根据 nvidia-smi 返回的原始 GPU 名匹配数据库，返回规范型号名与标准显存。
 * 匹配时取命中的最长关键词，避免 "3060" 误命中 "3060 Ti"。
 */
export function lookupGpu(gpuName: string | null | undefined): GpuLookup | null {
  if (!gpuName) return null;
  const s = gpuName.toLowerCase();
  let best: { entry: GpuDbEntry; len: number } | null = null;
  for (const entry of GPU_DATABASE) {
    for (const kw of entry.keywords) {
      if (s.includes(kw) && (!best || kw.length > best.len)) {
        best = { entry, len: kw.length };
      }
    }
  }
  return best ? { name: best.entry.name, vramGb: best.entry.vramGb } : null;
}
