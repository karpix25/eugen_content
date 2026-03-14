import React from 'react';
import { Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SubtitleSettingsProps {
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  style: string;
  setStyle: (val: string) => void;
  fontFamily: string;
  setFontFamily: (val: string) => void;
  fontSize: number;
  setFontSize: (val: number) => void;
  position: string;
  setPosition: (val: string) => void;
  fontColor: string;
  setFontColor: (val: string) => void;
  outlineColor: string;
  setOutlineColor: (val: string) => void;
  highlightEnabled: boolean;
  setHighlightEnabled: (val: boolean) => void;
  highlightColor: string;
  setHighlightColor: (val: string) => void;
}

const SUBTITLE_STYLES = [
  { id: '1_word', name: '1 Слово' },
  { id: 'karaoke', name: 'Караоке' },
  { id: '3_words', name: '3 Слова' },
];

const FONT_FAMILIES = [
  { id: 'Anton', name: 'Anton' },
  { id: 'Montserrat', name: 'Montserrat' },
  { id: 'Roboto', name: 'Roboto Black' },
  { id: 'Oswald', name: 'Oswald' }
];

export function SubtitleSettings({
  enabled, setEnabled,
  style, setStyle,
  fontFamily, setFontFamily,
  fontSize, setFontSize,
  position, setPosition,
  fontColor, setFontColor,
  outlineColor, setOutlineColor,
  highlightEnabled, setHighlightEnabled,
  highlightColor, setHighlightColor
}: SubtitleSettingsProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between bg-white/[0.03] p-4 rounded-2xl border border-white/5">
        <div className="space-y-1">
          <span className="text-xs font-black text-white uppercase tracking-[0.2em]">Субтитры</span>
          <p className="text-[10px] text-white/40 font-medium leading-relaxed">Отображать текст на видео</p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-14 h-7 rounded-full transition-all relative ${enabled ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-white/10'}`}
        >
          <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${enabled ? 'translate-x-7 shadow-sm' : ''}`} />
        </button>
      </div>

      <div className="space-y-8">
        <div>
          <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em] px-1">Стиль отображения</label>
          <div className="grid grid-cols-3 gap-3">
            {SUBTITLE_STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`text-[10px] uppercase font-black py-4 px-1 rounded-2xl transition-all border-2 ${style === s.id ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("transition-all duration-300", enabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale')}>
          <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em] px-1">Шрифт</label>
          <div className="grid grid-cols-4 gap-2">
            {FONT_FAMILIES.map(font => (
              <button
                key={font.id}
                onClick={() => setFontFamily(font.id)}
                className={`text-center py-3 px-2 rounded-xl text-[10px] font-black transition-all border-2 ${fontFamily === font.id ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-black/30 border-white/5 text-white/40 hover:bg-white/5 hover:border-white/20'}`}
              >
                {font.name}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("grid grid-cols-2 gap-6 transition-all duration-300", enabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale')}>
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex justify-between items-end">
              <span>Размер</span>
              <span className="text-emerald-400 font-mono text-[12px]">{fontSize}px</span>
            </label>
            <div className="px-1">
              <input type="range" min="10" max="64" step="1" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex justify-between items-end">
              <span>Позиция</span>
              <span className="text-emerald-400 font-mono text-[12px]">{position}%</span>
            </label>
            <div className="px-1">
              <input type="range" min="0" max="100" step="1" value={position} onChange={(e) => setPosition(e.target.value)} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            </div>
          </div>
        </div>

        <div className={cn("grid grid-cols-2 gap-6 transition-all duration-300", enabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale')}>
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Цвет текста</label>
            <div className="flex gap-3 bg-black/40 border border-white/5 p-1.5 rounded-2xl items-center">
              <div className="relative w-10 h-10 shrink-0">
                <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="w-full h-full rounded-xl shadow-inner border border-white/10" style={{ backgroundColor: fontColor }} />
              </div>
              <input type="text" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="flex-1 bg-transparent border-none text-[12px] font-mono text-white/90 focus:ring-0 outline-none uppercase" />
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Цвет обводки</label>
            <div className="flex gap-3 bg-black/40 border border-white/5 p-1.5 rounded-2xl items-center">
              <div className="relative w-10 h-10 shrink-0">
                <input type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="w-full h-full rounded-xl shadow-inner border border-white/10" style={{ backgroundColor: outlineColor }} />
              </div>
              <input type="text" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} className="flex-1 bg-transparent border-none text-[12px] font-mono text-white/90 focus:ring-0 outline-none uppercase" />
            </div>
          </div>
        </div>

        <div className={cn("transition-all duration-300 space-y-4", (enabled && style === 'karaoke') ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale')}>
          <div className="flex items-center justify-between px-1">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Выделение активного слова</label>
            <button onClick={() => setHighlightEnabled(!highlightEnabled)} className={`w-10 h-5 rounded-full transition-all relative ${highlightEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${highlightEnabled ? 'translate-x-5 shadow-sm' : ''}`} />
            </button>
          </div>
          <div className={cn("flex gap-3 bg-black/40 border border-white/5 p-1.5 rounded-2xl items-center transition-all duration-300", highlightEnabled ? 'opacity-100' : 'opacity-40')}>
            <div className="relative w-10 h-10 shrink-0">
              <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="w-full h-full rounded-xl shadow-inner border border-white/10" style={{ backgroundColor: highlightColor }} />
            </div>
            <input type="text" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} className="flex-1 bg-transparent border-none text-[12px] font-mono text-white/90 focus:ring-0 outline-none uppercase" />
          </div>
        </div>
      </div>
    </div>
  );
}
