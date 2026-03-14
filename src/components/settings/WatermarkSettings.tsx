import React from 'react';
import { Type, MousePointer2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WatermarkSettingsProps {
  text: string;
  setText: (val: string) => void;
  opacity: number;
  setOpacity: (val: number) => void;
  position: string;
  setPosition: (val: string) => void;
}

export function WatermarkSettings({
  text, setText,
  opacity, setOpacity,
  position, setPosition
}: WatermarkSettingsProps) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-[2rem] p-8 space-y-8 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
      
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
          <Type className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Водяной знак</h3>
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Защита вашего контента</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Текст знака</label>
          <div className="relative">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="@username"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:border-emerald-500/50 outline-none transition-all placeholder:text-white/10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Прозрачность</label>
              <span className="text-[10px] font-mono font-black text-emerald-400">{Math.round(opacity * 100)}%</span>
            </div>
            <div className="relative py-2">
              <input 
                type="range" 
                min="0.01" max="0.5" step="0.01" 
                value={opacity} 
                onChange={(e) => setOpacity(parseFloat(e.target.value))} 
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Позиция</label>
            <div className="relative group/select">
              <select 
                value={position} 
                onChange={(e) => setPosition(e.target.value)} 
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-[10px] font-black uppercase text-white hover:border-white/20 focus:border-emerald-500/50 outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="center">По центру</option>
                <option value="top_left">Слева сверху</option>
                <option value="top_right">Справа сверху</option>
                <option value="bottom_left">Слева снизу</option>
                <option value="bottom_right">Справа снизу</option>
                <option value="tilted_center">Наклон (Центр)</option>
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover/select:text-white/40 transition-colors">
                <MousePointer2 className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
