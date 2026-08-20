import { memo } from "react";
import type { ReactNode } from "react";

export const SidebarItem = memo(function SidebarItem({
  title,
  desc,
  icon,
  active = false,
  onClick,
  collapsed = false,
}: {
  title: string;
  desc?: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? title : undefined}
      className={`rounded-xl border transition ${
        collapsed ? "w-11 h-11 flex items-center justify-center p-0" : "w-full text-left px-3 py-2.5"
      } ${
        active
          ? "border-brand-500/40 bg-brand-50 dark:bg-brand-500/10 shadow-sm"
          : "dark:border-slate-800 border-slate-200 dark:bg-slate-950/30 bg-slate-50/80 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "" : "gap-2.5"}`}>
        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
          active
            ? "bg-brand-500/15 text-brand-700 dark:text-brand-200"
            : "dark:bg-slate-900 bg-white dark:text-slate-300 text-slate-700"
        }`}>
          {icon}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className={`text-[12.5px] font-semibold ${active ? "text-brand-700 dark:text-brand-200" : "dark:text-slate-200 text-slate-800"}`}>
              {title}
            </div>
          </div>
        )}
      </div>
    </button>
  );
});
