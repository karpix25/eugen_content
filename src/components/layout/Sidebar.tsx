import React from 'react';
import { 
  Bot, 
  Video, 
  Users, 
  ClipboardList, 
  Settings, 
  ScrollText, 
  LogOut, 
  RefreshCw 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { User } from '../../types';
import { NavButton } from './NavButton';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  currentUser: User | null;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout, 
  isOpen, 
  setIsOpen 
}: SidebarProps) {
  const isAdmin = currentUser?.is_admin;

  return (
    <>
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-72 bg-black border-r border-white/5 z-40 transition-transform lg:translate-x-0 overflow-y-auto custom-scrollbar",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 space-y-8">
          <div className="flex items-center gap-4 group">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] group-hover:rotate-12 transition-transform duration-500">
              <RefreshCw className="w-6 h-6 text-black animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white">CONTENT<span className="text-emerald-500">MACHINE</span></h1>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">Video Automation</p>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            {isAdmin && (
              <>
                <div className="px-4 py-2 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Управление</div>
                <NavButton 
                  active={activeTab === 'monitor'} 
                  onClick={() => { setActiveTab('monitor'); setIsOpen(false); }} 
                  icon={<Bot className="w-5 h-5" />} 
                  label="Мониторинг" 
                />
              </>
            )}
            
            <div className="px-4 py-2 mt-4 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Контент</div>
            <NavButton 
              active={activeTab === 'clips'} 
              onClick={() => { setActiveTab('clips'); setIsOpen(false); }} 
              icon={<Video className="w-5 h-5" />} 
              label="Видео-нарезки" 
            />
            {isAdmin && (
              <NavButton 
                active={activeTab === 'workers'} 
                onClick={() => { setActiveTab('workers'); setIsOpen(false); }} 
                icon={<Users className="w-5 h-5" />} 
                label="Работники" 
              />
            )}
            {isAdmin && (
              <NavButton 
                active={activeTab === 'publications'} 
                onClick={() => { setActiveTab('publications'); setIsOpen(false); }} 
                icon={<ClipboardList className="w-5 h-5" />} 
                label="Публикации" 
              />
            )}
            
            <div className="px-4 py-2 mt-4 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Настройки</div>
            <NavButton 
              active={activeTab === 'settings'} 
              onClick={() => { setActiveTab('settings'); setIsOpen(false); }} 
              icon={<Settings className="w-5 h-5" />} 
              label="Профиль" 
            />
            {isAdmin && (
              <NavButton 
                active={activeTab === 'styles'} 
                onClick={() => { setActiveTab('styles'); setIsOpen(false); }} 
                icon={<ScrollText className="w-5 h-5" />} 
                label="Стили" 
              />
            )}
          </nav>

          <div className="pt-8 border-t border-white/5">
            <div className="flex items-center gap-3 px-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-500 border border-emerald-500/20">
                {currentUser?.first_name?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentUser?.first_name}</p>
                <p className="text-[10px] text-white/40 truncate">@{currentUser?.username}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all font-bold group"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm">Выйти</span>
            </button>
          </div>
        </div>
      </aside>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
