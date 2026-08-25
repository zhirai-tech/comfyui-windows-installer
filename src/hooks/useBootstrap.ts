import { useEffect, useState } from "react";
import { useInstallerStore } from "../store/installerStore";
import { isTauriWindow } from "../lib/env";
import { translate, useI18n } from "../lib/i18n";

export function useBootstrap() {
  const [envIsTauri] = useState(() => isTauriWindow());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapMsg] = useState(() =>
    translate(useI18n.getState().lang, "boot.msg.checking")
  );

  useEffect(() => {
    // 纯 Web：打开即进入工作流市场，不做任何本地探测（CPU/GPU/是否已安装等）。
    // 本地执行器是否在线，仅在用户点击「安装/刷新」时按需探测。
    useInstallerStore.getState().go("manage");
    setBootstrapping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { envIsTauri, bootstrapping, bootstrapMsg };
}
