import { create } from "zustand";

// 一键安装弹窗全局状态：同一时间只允许一个安装引导弹窗打开。
export interface InstallTarget {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  externalUrl: string | null;
}

export const useInstallModalStore = create<{
  target: InstallTarget | null;
  open: (t: InstallTarget) => void;
  close: () => void;
}>((set) => ({
  target: null,
  open: (t) => set({ target: t }),
  close: () => set({ target: null }),
}));
