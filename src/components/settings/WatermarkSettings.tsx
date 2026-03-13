import React from 'react';
import { Zap } from 'lucide-react';

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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 backdrop-blur-xl">
      <div className="space-y-5">
        <div>
          <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em]">Текст знака</label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em] flex justify-between">
              <span>Прозрачность</span>
              <span className="text-emerald-400 font-mono">{Math.round(opacity * 100)}%</span>
            </label>
            <input type="range" min="0.01" max="0.5" step="0.01" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em]">Позиция</label>
            <select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-[10px] font-black uppercase text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer">
              <option value="center">По центру</option>
              <option value="top_left">Слева сверху</option>
              <option value="top_right">Справа сверху</option>
              <option value="bottom_left">Слева снизу</option>
              <option value="bottom_right">Справа снизу</option>
              <option value="tilted_center">Наклон (Центр)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
