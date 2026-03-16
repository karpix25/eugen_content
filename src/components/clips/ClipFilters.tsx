import React from 'react';
import { cn } from '../../lib/utils';

interface ClipFiltersProps {
  filterMode: 'all' | 'new' | 'published';
  onFilterModeChange: (mode: 'all' | 'new' | 'published') => void;
  languageFilter: 'all' | 'ru' | 'en';
  onLanguageChange: (lang: 'all' | 'ru' | 'en') => void;
}

export function ClipFilters({
  filterMode,
  onFilterModeChange,
  languageFilter,
  onLanguageChange
}: ClipFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 w-full">
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
            Все ✨
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
