import React from 'react';
import { Bot, Sparkles, Zap } from 'lucide-react';

interface AutoModeSettingsProps {
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  videosPerDay: number;
  setVideosPerDay: (val: number) => void;
}

export function AutoModeSettings({
  enabled, setEnabled,
  videosPerDay, setVideosPerDay
}: AutoModeSettingsProps) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-500">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Авто-постинг</h3>
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Полная автоматизация</p>
          </div>
        </div>
        
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-14 h-8 rounded-2xl transition-all relative flex items-center px-1 ${enabled ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'bg-white/5 border border-white/5'}`}
        >
          <div className={`w-6 h-6 rounded-xl bg-white transition-all duration-500 shadow-sm ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      {enabled ? (
        <div className="space-y-6 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Роликов в день</label>
              <span className="text-[10px] font-mono font-black text-blue-400">{videosPerDay}</span>
            </div>
            <div className="relative py-2">
              <input
                type="range" min="1" max="20" step="1"
                value={videosPerDay}
                onChange={(e) => setVideosPerDay(parseInt(e.target.value))}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[8px] font-black text-white/10 px-1 pt-2 uppercase tracking-widest">
                <span>min (1)</span>
                <span>max (20)</span>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-600/5 border border-blue-600/10 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-400/60 font-medium leading-relaxed">
              Система будет автоматически генерировать и подготавливать для вас <span className="text-blue-500 font-bold">{videosPerDay}</span> уникальных видео каждые 24 часа.
            </p>
          </div>
        </div>
      ) : (
        <div className="py-2">
          <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest text-center italic">Авто-режим выключен</p>
        </div>
      )}
    </div>
  );
}
