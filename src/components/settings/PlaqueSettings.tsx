import React, { useState } from 'react';
import { cn } from '../../lib/utils';
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
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl">
      <div className="space-y-6">
        <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.3em] px-1">Ваша коллекция плашек</label>

        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar p-1">
          {plaques.map(plaque => (
            <div key={plaque.id} className="relative group">
              <button
                onClick={() => setDefaultPlaqueId(plaque.id)}
                className={cn(
                  "w-full aspect-square flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
                  defaultPlaqueId === plaque.id 
                    ? 'bg-emerald-500 border-emerald-400 shadow-xl shadow-emerald-500/20' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                )}
              >
                <img 
                  src={plaque.image_url} 
                  className={cn(
                    "w-full h-full object-contain mb-2 drop-shadow-xl transition-transform duration-500",
                    defaultPlaqueId === plaque.id ? 'scale-110' : 'group-hover:scale-110'
                  )} 
                  alt="" 
                />
                <p className={cn(
                  "font-black text-[8px] uppercase tracking-[0.1em] truncate w-full text-center mt-2",
                  defaultPlaqueId === plaque.id ? 'text-black' : 'text-white/40'
                )}>
                  {plaque.name}
                </p>
                
                {defaultPlaqueId === plaque.id && (
                  <div className="absolute top-2 right-2 bg-black/20 p-1 rounded-full">
                    <Zap className="w-3 h-3 text-black" />
                  </div>
                )}
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); onDeletePlaque(plaque.id); }}
                className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 z-10"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}

          {isAdmin && (
            <div className="aspect-square">
              <label className="cursor-pointer h-full">
                <form onSubmit={async (e) => {
                  setUploadLoading(true);
                  await onAddPlaque(e);
                  setUploadLoading(false);
                }} className="h-full">
                  <input type="file" name="file" accept="image/*" required onChange={(e) => e.target.form?.requestSubmit()} className="hidden" />
                  <input type="hidden" name="name" value={`Plaque ${plaques.length + 1}`} />
                  <div className="w-full h-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-white/20 hover:border-emerald-500/50 hover:text-emerald-500/50 hover:bg-emerald-500/5 transition-all group">
                    {uploadLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">Загрузить</span>
                  </div>
                </form>
              </label>
            </div>
          )}
        </div>



        <div className="pt-4 space-y-6">
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Расположение</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'top', label: 'Сверху' },
                { id: 'center', label: 'Центр' },
                { id: 'bottom', label: 'Снизу' }
              ].map(pos => (
                <button
                  key={pos.id}
                  onClick={() => setPosition(pos.id)}
                  className={`text-[10px] uppercase font-black py-4 rounded-2xl border-2 transition-all ${position === pos.id ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10'}`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex justify-between items-end">
              <span>Масштаб</span>
              <span className="text-emerald-400 font-mono text-[12px]">{size}%</span>
            </label>
            <div className="px-1">
              <input type="range" min="20" max="100" step="1" value={size} onChange={(e) => setSize(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex justify-between items-end">
              <span>Появление</span>
              <span className="text-emerald-400 font-mono text-[12px]">
                {timerange === 0 ? 'СРАЗУ' : `ДО ${timerange}%`}
              </span>
            </label>
            <div className="px-1">
              <input type="range" min="0" max="100" step="5" value={timerange} onChange={(e) => setTimerange(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              <p className="text-[9px] text-white/20 mt-3 font-medium uppercase tracking-[0.1em] leading-relaxed">Плашка появится в случайный момент времени до указанного процента видео.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
