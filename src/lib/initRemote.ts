import { useInstallerStore } from "../store/installerStore";
import {
  fetchRemoteManifest,
  buildManifestContent,
  getManifestBaseUrl,
  isNewerVersion,
} from "./manifest";
import { getAppVersion } from "./appVersion";
import { setTelemetryBaseUrl, reportTelemetry } from "./telemetry";

let __inited = false;

/**
 * 启动时初始化远程内容：
 * 1. 读取本地版本号
 * 2. 拉取远程 manifest（失败用本地兜底）
 * 3. 设置上报 base 地址
 * 4. 版本检测（发现新版 → 写入 updateInfo 供 UI 提示）
 * 5. 上报启动埋点
 */
export async function initRemoteContent() {
  if (__inited) return;
  __inited = true;

  const st = useInstallerStore.getState();

  const appVersion = await getAppVersion();
  st.setAppVersion(appVersion);

  setTelemetryBaseUrl(getManifestBaseUrl());

  const remote = await fetchRemoteManifest();
  const content = buildManifestContent(remote);
  st.setManifestContent(content);

  if (content.latestVersion && isNewerVersion(appVersion, content.latestVersion)) {
    st.setUpdateInfo({
      latestVersion: content.latestVersion,
      downloadUrl: content.downloadUrl ?? "",
    });
  }

  reportTelemetry("app_start", { version: appVersion, source: content.source });
}
