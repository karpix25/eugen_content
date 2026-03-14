import React, { useState } from 'react';
import { ImageIcon, XCircle, Trash2, Plus, Loader2, Bot, Zap } from 'lucide-react';
import { AdPlaque } from '../../types';

interface PlaqueSettingsProps {
  plaques: AdPlaque[];
  defaultPlaqueId: string | null;
  setDefaultPlaqueId: (id: string | null) => void;
  position: string;
  setPosition: (pos: string) => void;
  size: number;
  setSize: (size: number) => void;
  timerange: number;
  setTimerange: (time: number) => void;
  onAddPlaque: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onDeletePlaque: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

export function PlaqueSettings({
  plaques,
  defaultPlaqueId, setDefaultPlaqueId,
  position, setPosition,
  size, setSize,
  timerange, setTimerange,
  onAddPlaque,
  onDeletePlaque,
  isAdmin = false
}: PlaqueSettingsProps) {
  const [uploadLoading, setUploadLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [topic, setTopic] = useState('');

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 backdrop-blur-xl">
      <div className="space-y-4">
        <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Выбрать основную</label>

        <div className="grid grid-cols-1 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">

          {plaques.map(plaque => (
            <div key={plaque.id} className="relative group">
              <button
                onClick={() => setDefaultPlaqueId(plaque.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${defaultPlaqueId === plaque.id ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 font-bold'}`}
              >
                <img src={plaque.image_url} className="w-10 h-10 rounded-lg object-cover bg-black border border-white/10" alt="" />
                <div className="text-left min-w-0 flex-1">
                  <p className="font-black text-[10px] uppercase tracking-[0.1em] truncate">{plaque.name}</p>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeletePlaque(plaque.id); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg group-hover:opacity-100 opacity-0 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Добавить в коллекцию</p>
            <form onSubmit={async (e) => {
              setUploadLoading(true);
              await onAddPlaque(e);
              setUploadLoading(false);
            }} className="space-y-2">
              <input name="name" required placeholder="Название (для списка)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500 placeholder:text-white/20" />
              <div className="relative group/file">
                <input type="file" name="file" accept="image/*" required className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/40 group-hover/file:border-white/20 transition-all flex items-center justify-between">
                  <span>Выбрать файл изображения</span>
                  <Plus className="w-4 h-4" />
                </div>
              </div>
              <button
                type="submit"
                disabled={uploadLoading}
                className="w-full bg-emerald-500 font-black text-[10px] uppercase tracking-[0.2em] text-black py-3 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {uploadLoading ? "ЗАГРУЗКА..." : "ЗАГРУЗИТЬ"}
              </button>
            </form>
          </div>
        )}

        {isAdmin && (
          <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">AI Генератор Nano Banana</p>
            </div>
            <div className="space-y-2">
              <input 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Тема или текст для плашки..." 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500 placeholder:text-white/20" 
              />
              <button
                onClick={async () => {
                  if (!topic) return;
                  setGenLoading(true);
                  try {
                    const res = await fetch('/api/ad-plaques/generate', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                      },
                      body: JSON.stringify({ topic, name: topic })
                    });
                    if (res.ok) {
                      setTopic('');
                      window.location.reload();
                    } else {
                      const err = await res.json();
                      alert(err.error || 'Ошибка генерации');
                    }
                  } catch (e) {
                    alert('Ошибка сети');
                  } finally {
                    setGenLoading(false);
                  }
                }}
                disabled={genLoading || !topic}
                className="w-full bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] py-3 rounded-xl hover:bg-emerald-400 hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {genLoading ? "ГЕНЕРАЦИЯ..." : "СГЕНЕРИРОВАТЬ ГЛОБАЛЬНО"}
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em]">Расположение на видео</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'top', label: 'Сверху' },
              { id: 'center', label: 'Центр' },
              { id: 'bottom', label: 'Снизу' }
            ].map(pos => (
              <button
                key={pos.id}
                onClick={() => setPosition(pos.id)}
                className={`text-[10px] uppercase font-black py-3 rounded-xl border transition-all ${position === pos.id ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 font-black' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em] flex justify-between">
            <span>Размер плашки</span>
            <span className="text-emerald-400 font-mono">{size}%</span>
          </label>
          <input type="range" min="20" max="100" step="1" value={size} onChange={(e) => setSize(parseInt(e.target.value))} className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-emerald-500" />
        </div>

        <div>
          <label className="block text-[10px] font-black text-white/40 mb-2 uppercase tracking-[0.2em] flex justify-between">
            <span>Появление на видео</span>
            <span className="text-emerald-400 font-mono">
              {timerange === 0 ? 'Сразу' : `Случайно до ${timerange}%`}
            </span>
          </label>
          <input type="range" min="0" max="100" step="5" value={timerange} onChange={(e) => setTimerange(parseInt(e.target.value))} className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          <p className="text-[10px] text-white/30 mt-2 font-medium">Если 0, плашка появится с самого начала. Если больше, она появится в случайный момент времени до указанного процента видео и останется до конца.</p>
        </div>
      </div>
    </div>
  );
}
