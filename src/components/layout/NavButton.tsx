import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  locked?: boolean;
}

export function NavButton({ active, onClick, icon, label, collapsed, locked }: NavButtonProps) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      className={cn(
        "w-full flex items-center rounded-xl transition-all duration-300 group relative overflow-hidden",
        collapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
        active
          ? "bg-blue-600 text-black font-semibold shadow-lg shadow-blue-600/20"
          : "text-white/60 hover:text-white hover:bg-white/5",
        locked && "opacity-40 cursor-not-allowed grayscale-[0.5]"
      )}
      title={collapsed ? (locked ? `${label} (Заблокировано)` : label) : undefined}
      disabled={locked}
    >
      <span className={cn("transition-transform duration-300 shrink-0", active ? "scale-110" : "group-hover:scale-110")}>
        {icon}
      </span>
      {!collapsed && <span className="text-sm tracking-wide truncate transition-opacity duration-300">{label}</span>}
      
      {locked && !collapsed && (
        <Lock className="w-3.5 h-3.5 ml-auto text-white/30" />
      )}

      {locked && collapsed && (
        <div className="absolute top-1 right-1">
          <Lock className="w-2.5 h-2.5 text-blue-500/50" />
        </div>
      )}
    </button>
  );
}
