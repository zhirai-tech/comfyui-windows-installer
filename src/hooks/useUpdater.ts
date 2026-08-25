// 更新功能后置：Web 化后暂不接入自动更新（原 Tauri plugin-updater 已移除）。
// 保留 hook 形状以便 App.tsx 无缝调用，全部为 no-op。
export function useUpdater() {
  return {
    update: null as { version: string } | null,
    checking: false,
    downloading: false,
    installed: false,
    error: null as string | null,
    checkForUpdate: async () => {},
    downloadAndInstall: async () => false,
  };
}
