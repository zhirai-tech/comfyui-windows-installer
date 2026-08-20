// 联系作者信息集中管理：侧边栏、页脚、设置页共用。
// 需要新增联系方式时，只需往 CONTACT_CHANNELS 里加一条即可。
import type { LocalizedText } from "./i18n";

export type ContactKind = "qq" | "email" | "link" | "qr";

export interface ContactChannel {
  id: string;
  label: LocalizedText;
  value: string;
  kind: ContactKind;
  /** 打开链接（qq/link 为跳转地址，email 为 mailto:） */
  url?: string;
  /** 二维码/图片地址（有则显示二维码，没有则显示 logo） */
  qrImage?: string;
  hint?: LocalizedText;
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    id: "github",
    label: { zh: "GitHub", en: "GitHub" },
    value: "zhirai-tech/comfyui-installer",
    kind: "link",
    url: "https://github.com/zhirai-tech/comfyui-installer",
    hint: { zh: "查看源码与提交问题", en: "View source and report issues" },
  },
];
