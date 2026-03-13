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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white/60 uppercase tracking-widest">Включить субтитры</span>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-14 h-7 rounded-full transition-all relative ${enabled ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}
        >
          <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${enabled ? 'translate-x-7' : ''}`} />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em]">Стиль отображения</label>
          <div className="grid grid-cols-3 gap-2">
            {SUBTITLE_STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`text-[10px] uppercase font-black py-3 px-1 rounded-xl transition-all border ${style === s.id ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className={enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
          <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em]">Шрифт</label>
          <div className="grid grid-cols-4 gap-1.5">
            {FONT_FAMILIES.map(font => (
              <button
                key={font.id}
                onClick={() => setFontFamily(font.id)}
                className={`text-center py-2 px-2 rounded-lg text-[10px] font-bold transition-all border ${fontFamily === font.id ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-black/30 border-white/5 text-white/50 hover:bg-white/5 hover:border-white/20'}`}
              >
                {font.name}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-4 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div>
            <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em] flex justify-between">
              <span>Размер</span>
              <span className="text-emerald-400 font-mono">{fontSize}px</span>
            </label>
            <input type="range" min="10" max="32" step="1" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em] flex justify-between">
              <span>Позиция</span>
              <span className="text-emerald-400 font-mono">{position}%</span>
            </label>
            <input type="range" min="0" max="100" step="1" value={position} onChange={(e) => setPosition(e.target.value)} className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-4 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div>
            <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em]">Цвет текста</label>
            <div className="flex gap-2">
              <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="w-10 h-10 rounded-xl border-0 bg-transparent cursor-pointer p-0" />
              <input type="text" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em]">Цвет обводки</label>
            <div className="flex gap-2">
              <input type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} className="w-10 h-10 rounded-xl border-0 bg-transparent cursor-pointer p-0" />
              <input type="text" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 outline-none" />
            </div>
          </div>
        </div>

        <div className={enabled && (style === 'karaoke') ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Выделение активного слова</label>
            <button onClick={() => setHighlightEnabled(!highlightEnabled)} className={`w-10 h-5 rounded-full transition-all relative ${highlightEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${highlightEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className={`flex gap-2 transition-opacity ${highlightEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} className="w-10 h-10 rounded-xl border-0 bg-transparent cursor-pointer p-0" />
            <input type="text" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 outline-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
