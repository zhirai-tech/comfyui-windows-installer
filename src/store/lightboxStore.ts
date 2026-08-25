import { create } from "zustand";

// 封面大图/视频弹窗：同一时间只允许一个打开（用资源 id 标识）。
export const useLightboxStore = create<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
}>((set) => ({
  openId: null,
  setOpenId: (id) => set({ openId: id }),
}));
