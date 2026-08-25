import { memo } from "react";
import type { ReactNode } from "react";

export const SidebarItem = memo(function SidebarItem({
  title,
  icon,
  active = false,
  onClick,
  collapsed = false,
}: {
  title: string;
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
      className={`flex items-center gap-2.5 rounded-lg transition ${
        collapsed ? "w-9 h-9 justify-center p-0" : "w-full px-2.5 py-1.5"
      } ${
        active
          ? "bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold"
          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50"
      }`}
    >
      {icon}
      {!collapsed && <span className="text-[12.5px] truncate">{title}</span>}
    </button>
  );
});
