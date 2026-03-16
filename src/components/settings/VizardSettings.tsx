import React, { useState, useEffect } from 'react';
import { Scissors, Loader2, CheckCircle, XCircle, Info, Zap, VolumeX, Image } from 'lucide-react';

interface VizardSettingsProps {
  authToken: string;
}

export function VizardSettings({ authToken }: VizardSettingsProps) {
  const [settings, setSettings] = useState({
    vizard_prefer_length: '2',
    vizard_remove_silence: '0',
    vizard_auto_broll: '0'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [authToken]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/vizard', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          vizard_prefer_length: data.vizard_prefer_length || '2',
          vizard_remove_silence: data.vizard_remove_silence || '0',
          vizard_auto_broll: data.vizard_auto_broll || '0'
        });
      }
    } catch (e) {
      console.error("Failed to fetch Vizard settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/vizard', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Настройки Vizard успешно сохранены!' });
      } else {
        setMessage({ type: 'error', text: 'Ошибка при сохранении настроек.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка сети при сохранении.' });
    } finally {
      setSaving(false);
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
      
      <div className="relative space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-600/20 shadow-lg shadow-blue-600/10">
            <Scissors className="w-6 h-6 text-blue-500" />
          </div>
          <div className="px-1">
            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Настройки Vizard AI</h3>
            <p className="text-[10px] md:text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Параметры интеллектуальной нарезки клипов</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
            {/* Preferred Length */}
            <div className="p-6 md:p-8 bg-black/40 border border-white/5 rounded-[2rem] group/card hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-600/5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
                    <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20 group-hover/card:bg-blue-600/20 transition-colors shadow-inner shrink-0 text-blue-500">
                            <Zap className="w-6 h-6" />
                        </div>
                        <h4 className="text-[11px] md:text-xs font-black text-white uppercase tracking-[0.2em] leading-tight">Длина клипов</h4>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                        <p className="text-xs md:text-sm text-white/50 font-medium leading-relaxed max-w-xl">
                            Определяет предпочтительный временной интервал для автоматически создаваемых клипов AI-ассистентом.
                        </p>
                    </div>

                    <div className="relative min-w-[280px]">
                        <select 
                            value={settings.vizard_prefer_length}
                            onChange={(e) => setSettings({...settings, vizard_prefer_length: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs md:text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-bold appearance-none cursor-pointer hover:bg-white/10 pr-12 uppercase tracking-widest"
                        >
                            <option value="0">Автоматически (Vizard AI)</option>
                            <option value="1">Менее 30 секунд</option>
                            <option value="2">От 30 до 60 секунд</option>
                            <option value="3">От 60 до 90 секунд</option>
                            <option value="4">От 90 секунд до 3 минут</option>
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                             <Scissors className="w-4 h-4 rotate-90" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Silence Removal */}
            <div className="p-6 md:p-8 bg-black/40 border border-white/5 rounded-[2rem] group/card hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-600/5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
                    <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20 group-hover/card:bg-blue-600/20 transition-colors shadow-inner shrink-0 text-blue-500">
                            <VolumeX className="w-6 h-6" />
                        </div>
                        <h4 className="text-[11px] md:text-xs font-black text-white uppercase tracking-[0.2em] leading-tight">Удаление тишины</h4>
                    </div>
                    
                    <div className="flex-1">
                        <p className="text-xs md:text-sm text-white/50 font-medium leading-relaxed max-w-xl">
                            Интеллектуальный анализатор автоматически вырезает длинные паузы и тишину из видео для повышения динамики и удержания внимания зрителей.
                        </p>
                    </div>

                    <div className="flex justify-end lg:min-w-[100px]">
                        <label className="relative inline-flex items-center cursor-pointer scale-110">
                            <input 
                                type="checkbox" 
                                checked={settings.vizard_remove_silence === '1'} 
                                onChange={(e) => setSettings({...settings, vizard_remove_silence: e.target.checked ? '1' : '0'})}
                                className="sr-only peer" 
                            />
                            <div className="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Auto B-Roll */}
            <div className="p-6 md:p-8 bg-black/40 border border-white/5 rounded-[2rem] group/card hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-600/5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
                    <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20 group-hover/card:bg-blue-600/20 transition-colors shadow-inner shrink-0 text-blue-500">
                            <Image className="w-6 h-6" />
                        </div>
                        <h4 className="text-[11px] md:text-xs font-black text-white uppercase tracking-[0.2em] leading-tight">Авто B-roll</h4>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                        <p className="text-xs md:text-sm text-white/50 font-medium leading-relaxed max-w-xl">
                            Автоматическая подстановка релевантных стоковых футажей во время пауз или для визуальной иллюстрации речи. 
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-blue-600/50" />
                            <span className="text-[9px] md:text-[10px] text-blue-500/60 font-black uppercase tracking-widest">
                                Увеличивает время обработки видео
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end lg:min-w-[100px]">
                        <label className="relative inline-flex items-center cursor-pointer scale-110">
                            <input 
                                type="checkbox" 
                                checked={settings.vizard_auto_broll === '1'} 
                                onChange={(e) => setSettings({...settings, vizard_auto_broll: e.target.checked ? '1' : '0'})}
                                className="sr-only peer" 
                            />
                            <div className="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full relative group/btn overflow-hidden rounded-[1.5rem]"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 opacity-100 group-hover/btn:scale-110 transition-transform duration-500" />
                    <div className="relative py-5 rounded-[1.5rem] flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                        ) : (
                            <CheckCircle className="w-5 h-5 text-white group-hover/btn:rotate-[360deg] transition-transform duration-700" />
                        )}
                        <span className="text-white font-black text-[11px] uppercase tracking-[0.3em]">
                            {saving ? 'Сохранение...' : 'Сохранить параметры'}
                        </span>
                    </div>
                </button>
            </div>
        </div>

        {message && (
          <div className={cn(
            "p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
            message.type === 'success' ? "bg-green-500/10 border border-green-500/20 text-green-500" : "bg-red-500/10 border border-red-500/20 text-red-500"
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
