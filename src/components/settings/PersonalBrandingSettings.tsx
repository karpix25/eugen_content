import React, { useState } from 'react';
import { User, Camera, ShieldCheck, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PersonalBrandingSettingsProps {
  useFaceInCarousels: boolean;
  setUseFaceInCarousels: (val: boolean) => void;
  faceImageUrl: string | null;
  telegramId: string;
  authToken: string;
  onUpdate: () => void;
}

export function PersonalBrandingSettings({
  useFaceInCarousels,
  setUseFaceInCarousels,
  faceImageUrl,
  telegramId,
  authToken,
  onUpdate
}: PersonalBrandingSettingsProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('face', file);

    try {
      const res = await fetch(`/api/users/${telegramId}/face`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (res.ok) {
        onUpdate();
      } else {
        alert('Ошибка при загрузке фото.');
      }
    } catch (err) {
      alert('Ошибка при загрузке фото.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 backdrop-blur-xl space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
            <User className="w-6 h-6 text-black" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Персональный Брендинг</h3>
            <p className="text-white/40 text-xs font-medium tracking-wide uppercase">Использование вашего лица в генерациях</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-[2rem] bg-black/20 group hover:border-emerald-500/50 transition-all duration-500">
            {faceImageUrl ? (
              <div className="relative">
                <img 
                  src={faceImageUrl} 
                  alt="Face reference" 
                  className="w-32 h-32 rounded-3xl object-cover border-4 border-emerald-500/20 shadow-2xl"
                />
                <label className="absolute -bottom-2 -right-2 p-2 bg-emerald-500 rounded-xl cursor-pointer hover:scale-110 transition-transform shadow-lg">
                  <Camera className="w-4 h-4 text-black" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-4 cursor-pointer">
                <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                  {uploading ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /> : <Camera className="w-8 h-8 text-white/20 group-hover:text-emerald-500" />}
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-xs uppercase tracking-widest">Загрузить фото лица</p>
                  <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">PNG, JPG до 5MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 group hover:border-emerald-500/30 transition-all">
            <div className="space-y-1">
              <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                Использовать лицо в каруселях
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] border border-emerald-500/20">NANO BANANA</span>
              </p>
              <p className="text-white/40 text-[10px] uppercase font-medium">ИИ будет генерировать персонажей похожих на вас</p>
            </div>
            <button
              onClick={() => setUseFaceInCarousels(!useFaceInCarousels)}
              className={cn(
                "w-12 h-6 rounded-full transition-all duration-500 relative p-1",
                useFaceInCarousels ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-white/10"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-full bg-white transition-all duration-500 shadow-md",
                useFaceInCarousels ? "translate-x-6" : "translate-x-0"
              )} />
            </button>
          </div>

          <div className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/10">
            <div className="flex gap-4">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="space-y-2">
                <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Совет для лучшего результата</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  Используйте четкое селфи при хорошем освещении, где хорошо видно лицо. ИИ проанализирует черты и будет использовать их при создании образа.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
