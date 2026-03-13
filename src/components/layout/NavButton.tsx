import React from 'react';
import { cn } from '../../lib/utils';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
}

export function NavButton({ active, onClick, icon, label, collapsed }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center rounded-xl transition-all duration-300 group",
        collapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
        active
          ? "bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20"
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
      title={collapsed ? label : undefined}
    >
      <span className={cn("transition-transform duration-300 shrink-0", active ? "scale-110" : "group-hover:scale-110")}>
        {icon}
      </span>
      {!collapsed && <span className="text-sm tracking-wide truncate transition-opacity duration-300">{label}</span>}
    </button>
  );
}
