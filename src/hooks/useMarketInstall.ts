import { openExternal } from "../lib/window";
import { useInstallModalStore } from "../store/installModalStore";
import { reportContentEvent } from "../lib/telemetry";

// 可「一键安装」的资源类型：工作流 / 智能体 / 模型
export const INSTALLABLE_TYPES = new Set(["workflow", "agent", "model"]);

export interface MarketResource {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  externalUrl: string | null;
}

// 市场资源的「查看 / 下载 / 一键安装」统一逻辑。
// 市场仅存元数据，资源本体在原平台：
// · 查看 = 跳转原平台详情（记录 view 事件）。
// · 下载 = 直接跳转原平台（记录 download 事件）。
// · 一键安装 = 打开自定义引导弹窗（记录 install 事件）。
// 所有操作都会把「本平台产生的行为」上报到 /api/event，供后台仪表盘统计，
// 与外部平台的下载量 / 热度无关。
export function useMarketInstall() {
  const openModal = useInstallModalStore((s) => s.open);

  const view = (r: MarketResource) => {
    reportContentEvent(r.type, r.id, "view");
    if (r.externalUrl) openExternal(r.externalUrl);
  };

  const download = (r: MarketResource) => {
    reportContentEvent(r.type, r.id, "download");
    if (r.externalUrl) openExternal(r.externalUrl);
  };

  const install = (r: MarketResource) => {
    reportContentEvent(r.type, r.id, "install");
    openModal(r);
  };

  return { view, download, install };
}
