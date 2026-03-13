import React from 'react';
import { Bot } from 'lucide-react';

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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white/60 uppercase tracking-widest">Включить Авто-постинг</span>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-14 h-7 rounded-full transition-all relative ${enabled ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-white/10'}`}
        >
          <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${enabled ? 'translate-x-7' : ''}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em] flex justify-between">
            <span>Количество роликов в день</span>
            <span className="text-purple-400 font-mono">{videosPerDay}</span>
          </label>
          <input
            type="range" min="1" max="20" step="1"
            value={videosPerDay}
            onChange={(e) => setVideosPerDay(parseInt(e.target.value))}
            className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-white/20 px-1 pt-1">
            <span>1</span>
            <span>20</span>
          </div>
          <p className="text-[10px] text-white/30 font-medium pt-2">Система будет автоматически отправлять вам по {videosPerDay} видео в день.</p>
        </div>
      )}
    </div>
  );
}
