import { useCallback } from "react";
import { useInstallerStore } from "../store/installerStore";

export function useEnvironmentCheck() {
  const running = useInstallerStore((s) => s.envCheckRunning);
  const items = useInstallerStore((s) => s.envCheckItems);
  const summary = useInstallerStore((s) => s.envCheckSummary);
  const error = useInstallerStore((s) => s.envCheckError);

  const run = useCallback(() => {
    void useInstallerStore.getState().runEnvCheck();
  }, []);

  return { running, items, summary, error, run };
}
