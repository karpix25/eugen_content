import { 
  Bot, 
  Video, 
  Users, 
  ClipboardList, 
  Settings, 
  ScrollText, 
  LogOut, 
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { User } from '../../types';
import { NavButton } from './NavButton';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  currentUser: User | null;
  onLogout: () => void;
  isOpen: boolean; // Using isOpen as "isExpanded"
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
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 lg:sticky lg:top-0 bg-[#0A0A0A] border-r border-white/5 z-50 transition-all duration-500 ease-in-out flex flex-col shrink-0 h-screen overflow-hidden",
        isOpen 
          ? "w-72 translate-x-0" 
          : "-translate-x-full lg:translate-x-0 lg:w-20"
      )}>
      <div className={cn(
        "p-4 md:p-6 space-y-8 h-full flex flex-col transition-all duration-500",
        !isOpen && "items-center px-0"
      )}>
        <div className={cn(
          "flex items-center gap-4 transition-all duration-500",
          isOpen ? "justify-between px-2" : "justify-center"
        )}>
          <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] group-hover:rotate-12 transition-transform duration-500 shrink-0 overflow-hidden">
              <img src="/logo.png" className="w-6 h-6 md:w-7 md:h-7 object-contain brightness-0" alt="MineHash" />
            </div>
            {isOpen && (
              <div className="transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                <h1 className="text-lg font-black tracking-tighter text-white uppercase italic">MINE<span className="text-emerald-500">HASH</span></h1>
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em]">Video Automation</p>
              </div>
            )}
          </div>

          {/* Toggle Button Inside */}
          {isOpen && (
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white shrink-0"
              title="Свернуть"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {!isOpen && (
          <button 
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"
            title="Развернуть"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <nav className={cn(
          "space-y-1.5 pt-4 flex-1 overflow-y-auto custom-scrollbar transition-all duration-500",
          isOpen ? "-mx-2 px-2" : "w-full flex flex-col items-center gap-1"
        )}>
          {isAdmin && (
            <>
              {isOpen && <div className="px-4 py-2 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Управление</div>}
              <NavButton 
                active={activeTab === 'monitor'} 
                onClick={() => setActiveTab('monitor')} 
                icon={<Bot className="w-5 h-5" />} 
                label="Мониторинг"
                collapsed={!isOpen}
              />
            </>
          )}
          
          {isOpen && <div className="px-4 py-2 mt-4 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Контент</div>}
          <NavButton 
            active={activeTab === 'clips'} 
            onClick={() => setActiveTab('clips')} 
            icon={<Video className="w-5 h-5" />} 
            label="Видео-нарезки"
            collapsed={!isOpen}
          />
          {isAdmin && (
            <NavButton 
              active={activeTab === 'workers'} 
              onClick={() => setActiveTab('workers')} 
              icon={<Users className="w-5 h-5" />} 
              label="Работники"
              collapsed={!isOpen}
            />
          )}
          {isAdmin && (
            <NavButton 
              active={activeTab === 'publications'} 
              onClick={() => setActiveTab('publications')} 
              icon={<ClipboardList className="w-5 h-5" />} 
              label="Публикации"
              collapsed={!isOpen}
            />
          )}
          
          {isOpen && <div className="px-4 py-2 mt-4 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Настройки</div>}
          <NavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={<Settings className="w-5 h-5" />} 
            label="Профиль"
            collapsed={!isOpen}
          />
          {isAdmin && (
            <NavButton 
              active={activeTab === 'styles'} 
              onClick={() => setActiveTab('styles')} 
              icon={<ScrollText className="w-5 h-5" />} 
              label="Стили"
              collapsed={!isOpen}
            />
          )}
        </nav>

        <div className={cn(
          "pt-6 border-t border-white/5 space-y-4",
          !isOpen && "flex flex-col items-center"
        )}>
          <div className={cn(
            "flex items-center gap-3 bg-white/5 rounded-2xl border border-white/5 transition-all duration-500",
            isOpen ? "px-4 py-2 w-full" : "p-2"
          )}>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-500 border border-emerald-500/20 shadow-inner shrink-0">
              {currentUser?.first_name?.[0] || 'U'}
            </div>
            {isOpen && (
              <div className="min-w-0 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{currentUser?.first_name}</p>
                <p className="text-[10px] text-white/40 truncate">@{currentUser?.username}</p>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className={cn(
              "flex items-center rounded-xl text-red-500 hover:bg-red-500/10 transition-all font-bold group border border-transparent hover:border-red-500/20",
              isOpen ? "w-full gap-3 px-4 py-3" : "justify-center p-3"
            )}
            title={!isOpen ? "Выйти" : undefined}
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform shrink-0" />
            {isOpen && <span className="text-sm transition-opacity duration-300">Выйти</span>}
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
