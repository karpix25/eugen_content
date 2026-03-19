import React, { useState, useEffect } from 'react';
import { ImageIcon, Loader2, Upload, CheckCircle, XCircle, Globe, Users } from 'lucide-react';

interface GlobalSettingsProps {
  authToken: string;
}

export function GlobalSettings({ authToken }: GlobalSettingsProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [targetAudience, setTargetAudience] = useState('');
  const [carouselDailyLimit, setCarouselDailyLimit] = useState('0');
  const [uploading, setUploading] = useState(false);
  const [savingAudience, setSavingAudience] = useState(false);
  const [savingCarouselLimit, setSavingCarouselLimit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [authToken]);

  const fetchSettings = async () => {
    try {
      const [logoRes, audienceRes, carouselLimitRes] = await Promise.all([
        fetch('/api/settings/logo', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch('/api/settings/analysis-target-audience', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch('/api/settings/carousel-limit', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ]);

      if (logoRes.ok) {
        const data = await logoRes.json();
        setLogoUrl(data.url);
      }

      if (audienceRes.ok) {
        const data = await audienceRes.json();
        setTargetAudience(data.value || '');
      }

      if (carouselLimitRes.ok) {
        const data = await carouselLimitRes.json();
        setCarouselDailyLimit(String(data.value ?? '0'));
      }
    } catch (e) {
      console.error("Failed to fetch global settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.url);
        setMessage({ type: 'success', text: 'Логотип успешно обновлен!' });
      } else {
        setMessage({ type: 'error', text: 'Ошибка при загрузке логотипа.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка сети при загрузке.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveAudience = async () => {
    if (!targetAudience.trim()) {
      setMessage({ type: 'error', text: 'Укажите целевую аудиторию для анализа.' });
      return;
    }

    setSavingAudience(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/analysis-target-audience', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: targetAudience.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        setTargetAudience(data.value);
        setMessage({ type: 'success', text: 'Целевая аудитория для анализа сохранена!' });
      } else {
        setMessage({ type: 'error', text: 'Ошибка при сохранении целевой аудитории.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка сети при сохранении.' });
    } finally {
      setSavingAudience(false);
    }
  };

  const handleSaveCarouselLimit = async () => {
    const value = Number(carouselDailyLimit);
    if (!Number.isFinite(value) || value < 0) {
      setMessage({ type: 'error', text: 'Лимит каруселей должен быть неотрицательным числом.' });
      return;
    }

    setSavingCarouselLimit(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/carousel-limit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
      });

      if (res.ok) {
        const data = await res.json();
        setCarouselDailyLimit(String(data.value));
        setMessage({ type: 'success', text: 'Суточный лимит каруселей сохранен!' });
      } else {
        setMessage({ type: 'error', text: 'Ошибка при сохранении лимита каруселей.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка сети при сохранении лимита.' });
    } finally {
      setSavingCarouselLimit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none group-hover:bg-blue-600/20 transition-colors duration-1000" />
      
      <div className="relative space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-600/20">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Глобальные Настройки</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Общие параметры для всех пользователей</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-600/20">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">ЦА для AI-анализа</h4>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Используется для оценки транскриптов и автопроверки новых видео</p>
              </div>
            </div>

            <textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all resize-none"
              placeholder="Например: предприниматели, эксперты и владельцы онлайн-бизнесов, интересующиеся AI и автоматизацией"
            />

            <button
              onClick={handleSaveAudience}
              disabled={savingAudience}
              className="inline-flex items-center gap-2 bg-blue-600 text-black px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50"
            >
              {savingAudience ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {savingAudience ? 'СОХРАНЯЕМ...' : 'СОХРАНИТЬ ЦА'}
            </button>
          </div>

          <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-600/20">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">Лимит каруселей в сутки</h4>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">0 = без лимита, значение применяется на пользователя</p>
              </div>
            </div>

            <input
              type="number"
              min="0"
              value={carouselDailyLimit}
              onChange={(e) => setCarouselDailyLimit(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
              placeholder="0"
            />

            <button
              onClick={handleSaveCarouselLimit}
              disabled={savingCarouselLimit}
              className="inline-flex items-center gap-2 bg-blue-600 text-black px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50"
            >
              {savingCarouselLimit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {savingCarouselLimit ? 'СОХРАНЯЕМ...' : 'СОХРАНИТЬ ЛИМИТ'}
            </button>
          </div>

          <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">Логотип для Каруселей</h4>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Отображается в углу каждого слайда (2x3 сетка)</p>
              </div>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                <div className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 px-4 py-2 rounded-xl border border-blue-600/20 transition-all font-black text-[10px] uppercase tracking-widest">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploading ? 'ЗАГРУЗКА...' : 'ВЫБРАТЬ ФАЙЛ'}
                </div>
              </label>
            </div>

            {logoUrl ? (
              <div className="relative aspect-video bg-black/60 rounded-xl overflow-hidden border border-white/10 group/logo">
                <img src={logoUrl} alt="Global Logo" className="w-full h-full object-contain p-4" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center">
                   <p className="text-[10px] font-black text-white uppercase tracking-widest">Текущий логотип</p>
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-black/40 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3">
                <ImageIcon className="w-8 h-8 text-white/10" />
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Логотип не установлен</p>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className={cn(
            "p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
            message.type === 'success' ? "bg-blue-600/10 border border-blue-600/20 text-blue-600" : "bg-red-500/10 border border-red-500/20 text-red-500"
          )}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
