import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ClipFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
   filterMode: 'all' | 'new' | 'published';
   onFilterModeChange: (mode: 'all' | 'new' | 'published') => void;
   languageFilter: 'all' | 'ru' | 'en';
   onLanguageChange: (lang: 'all' | 'ru' | 'en') => void;
 }
 
 export function ClipFilters({
   searchQuery,
   onSearchChange,
   filterMode,
   onFilterModeChange,
   languageFilter,
   onLanguageChange
 }: ClipFiltersProps) {
   return (
     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
       <div className="relative flex-1 max-w-md">
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
         <input
           type="text"
           placeholder="Поиск по названию или тексту..."
           value={searchQuery}
           onChange={(e) => onSearchChange(e.target.value)}
           className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm outline-none focus:border-emerald-500 transition-colors"
         />
       </div>
 
       <div className="flex flex-wrap items-center gap-4">
         <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex items-center">
           <button
             onClick={() => onFilterModeChange('new')}
             className={cn(
               "px-4 py-2 rounded-lg text-sm font-medium transition-all",
               filterMode === 'new' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white"
             )}
           >
             Новые
           </button>
           <button
             onClick={() => onFilterModeChange('published')}
             className={cn(
               "px-4 py-2 rounded-lg text-sm font-medium transition-all",
               filterMode === 'published' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white"
             )}
           >
             Опубликованные
           </button>
           <button
             onClick={() => onFilterModeChange('all')}
             className={cn(
               "px-4 py-2 rounded-lg text-sm font-medium transition-all",
               filterMode === 'all' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white"
             )}
           >
             Все
           </button>
         </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex items-center">
          <button
            onClick={() => onLanguageChange('all')}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", languageFilter === 'all' ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5")}
          >
            Все 🌍
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button
            onClick={() => onLanguageChange('ru')}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", languageFilter === 'ru' ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5")}
          >
            RU 🇷🇺
          </button>
          <button
            onClick={() => onLanguageChange('en')}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", languageFilter === 'en' ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5")}
          >
            EN 🇺🇸
          </button>
        </div>
      </div>
    </div>
  );
}
