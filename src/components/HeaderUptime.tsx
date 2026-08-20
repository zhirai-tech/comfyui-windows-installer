import { memo, useEffect, useState } from "react";
import { useT, type TFunc } from "../lib/i18n";

function fmtHeaderUptime(seconds: number, t: TFunc) {
  if (!seconds || seconds < 1) return t("uptime.zero");
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return t("uptime.hours", { h, m });
  if (m > 0) return t("uptime.minutes", { m, s });
  return t("uptime.seconds", { s });
}

export const HeaderUptime = memo(function HeaderUptime({
  status,
  startedAt,
}: {
  status: string;
  startedAt?: string;
}) {
  const t = useT();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running" || !startedAt) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status, startedAt]);

  if (status !== "running" || !startedAt) return null;

  let seconds = 0;
  try {
    if (startedAt.startsWith("utc_")) {
      const unixSeconds = Number(startedAt.slice(4));
      if (!Number.isNaN(unixSeconds) && unixSeconds > 0) {
        seconds = Math.max(0, Math.floor(nowMs / 1000 - unixSeconds));
      }
    } else {
      const start = new Date(startedAt).getTime();
      if (!Number.isNaN(start)) {
        seconds = Math.max(0, Math.floor((nowMs - start) / 1000));
      }
    }
  } catch {
    seconds = 0;
  }

  return (
    <div className="text-[12px] font-semibold dark:text-slate-300 text-slate-700">
      {t("uptime.running", { time: fmtHeaderUptime(seconds, t) })}
    </div>
  );
});
