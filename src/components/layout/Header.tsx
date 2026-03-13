import React from 'react';
import { 
  Bell, 
  Search, 
  ShieldCheck,
  Menu
} from 'lucide-react';
import { User } from '../../types';

interface HeaderProps {
  currentUser: User;
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
}

export function Header({ currentUser, onMenuToggle, isSidebarOpen }: HeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
      <div className="flex items-center gap-4">
          <button 
            onClick={onMenuToggle}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group lg:hidden"
          >
            <Menu className="w-6 h-6 text-white/40 group-hover:text-emerald-500 transition-colors" />
          </button>
        <div className="space-y-1">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter">
            Привет, <span className="text-emerald-500">{currentUser.first_name}</span>!
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Система активна</span>
            </div>
            <span className="text-white/20 text-xs font-medium">@{currentUser.username}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white/40 focus-within:border-emerald-500/50 transition-all">
          <Search className="w-4 h-4" />
          <input type="text" placeholder="Поиск ролика..." className="bg-transparent border-none outline-none text-xs font-medium w-48 placeholder:text-white/10" />
        </div>
        
        <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all relative group">
          <Bell className="w-5 h-5 text-white/40 group-hover:text-emerald-500 transition-colors" />
          <div className="absolute top-3.5 right-3.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#0A0A0A]" />
        </button>

        <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-1.5 pr-4 rounded-2xl hover:border-white/20 transition-all cursor-pointer group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-black text-xs shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform uppercase">
            {currentUser.first_name?.[0]}
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest leading-none flex items-center gap-1">
                {currentUser.is_admin ? 'Admin' : 'Author'}
                {currentUser.is_admin && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
