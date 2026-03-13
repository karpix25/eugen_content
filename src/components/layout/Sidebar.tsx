import { 
  Bot, 
  Video, 
  Users, 
  ClipboardList, 
  Settings, 
  ScrollText, 
  LogOut, 
  RefreshCw,
  X 
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
        "bg-[#0A0A0A] border-r border-white/5 z-50 transition-all duration-500 ease-in-out flex flex-col shrink-0 h-screen",
        // Mobile
        "fixed inset-y-0 left-0 w-72 lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)] lg:shadow-none" : "-translate-x-full lg:w-0 lg:opacity-0 lg:pointer-events-none lg:border-none lg:-translate-x-full"
      )}>
        <div className="p-6 md:p-8 space-y-8 h-full flex flex-col min-w-[18rem]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] group-hover:rotate-12 transition-transform duration-500">
                <RefreshCw className="w-5 h-5 md:w-6 md:h-6 text-black animate-spin-slow" />
              </div>
              <div className="transition-opacity duration-300">
                <h1 className="text-xl font-black tracking-tighter text-white">CONTENT<span className="text-emerald-500">MACHINE</span></h1>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">Video Automation</p>
              </div>
            </div>

            {/* Close Toggle */}
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"
              title="Закрыть меню"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1.5 pt-4 flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
            {isAdmin && (
              <>
                <div className="px-4 py-2 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Управление</div>
                <NavButton 
                  active={activeTab === 'monitor'} 
                  onClick={() => { setActiveTab('monitor'); if (window.innerWidth < 1024) setIsOpen(false); }} 
                  icon={<Bot className="w-5 h-5" />} 
                  label="Мониторинг" 
                />
              </>
            )}
            
            <div className="px-4 py-2 mt-4 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Контент</div>
            <NavButton 
              active={activeTab === 'clips'} 
              onClick={() => { setActiveTab('clips'); if (window.innerWidth < 1024) setIsOpen(false); }} 
              icon={<Video className="w-5 h-5" />} 
              label="Видео-нарезки" 
            />
            {isAdmin && (
              <NavButton 
                active={activeTab === 'workers'} 
                onClick={() => { setActiveTab('workers'); if (window.innerWidth < 1024) setIsOpen(false); }} 
                icon={<Users className="w-5 h-5" />} 
                label="Работники" 
              />
            )}
            {isAdmin && (
              <NavButton 
                active={activeTab === 'publications'} 
                onClick={() => { setActiveTab('publications'); if (window.innerWidth < 1024) setIsOpen(false); }} 
                icon={<ClipboardList className="w-5 h-5" />} 
                label="Публикации" 
              />
            )}
            
            <div className="px-4 py-2 mt-4 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Настройки</div>
            <NavButton 
              active={activeTab === 'settings'} 
              onClick={() => { setActiveTab('settings'); if (window.innerWidth < 1024) setIsOpen(false); }} 
              icon={<Settings className="w-5 h-5" />} 
              label="Профиль" 
            />
            {isAdmin && (
              <NavButton 
                active={activeTab === 'styles'} 
                onClick={() => { setActiveTab('styles'); if (window.innerWidth < 1024) setIsOpen(false); }} 
                icon={<ScrollText className="w-5 h-5" />} 
                label="Стили" 
              />
            )}
          </nav>

          <div className="pt-8 border-t border-white/5 space-y-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-500 border border-emerald-500/20 shadow-inner">
                {currentUser?.first_name?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentUser?.first_name}</p>
                <p className="text-[10px] text-white/40 truncate">@{currentUser?.username}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all font-bold group border border-transparent hover:border-red-500/20"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm">Выйти</span>
            </button>
          </div>
        </div>
      </aside>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[45] lg:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
