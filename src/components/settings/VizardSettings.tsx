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

    return (
        <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-6 md:p-8 space-y-8 shadow-2xl relative overflow-hidden group/main">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -mr-32 -mt-32 rounded-full pointer-events-none" />
            
            <div className="space-y-10">
                {/* Preferred Length */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20 text-blue-500">
                            <Zap className="w-5 h-5" />
                        </div>
                        <h4 className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.2em] leading-tight">Длина клипов</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <p className="text-[11px] md:text-sm text-white/40 font-medium leading-relaxed">
                            Определяет предпочтительный временной интервал для автоматически создаваемых клипов AI-ассистентом.
                        </p>
                        <div className="relative">
                            <select 
                                value={settings.vizard_prefer_length}
                                onChange={(e) => setSettings({...settings, vizard_prefer_length: e.target.value})}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-[11px] md:text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-bold appearance-none cursor-pointer hover:bg-white/10 pr-12 uppercase tracking-widest"
                            >
                                <option value="0">Автоматически (Vizard AI)</option>
                                <option value="1">Менее 30 секунд</option>
                                <option value="2">От 30 до 60 секунд</option>
                                <option value="3">От 60 до 90 секунд</option>
                                <option value="4">От 90 секунд до 3 минут</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                 <Scissors className="w-4 h-4 rotate-90" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-white/5 w-full" />

                {/* Silence Removal */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20 text-blue-500">
                                <VolumeX className="w-5 h-5" />
                            </div>
                            <h4 className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.2em] leading-tight">Удаление тишины</h4>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={settings.vizard_remove_silence === '1'} 
                                onChange={(e) => setSettings({...settings, vizard_remove_silence: e.target.checked ? '1' : '0'})}
                                className="sr-only peer" 
                            />
                            <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>
                    
                    <p className="text-[11px] md:text-sm text-white/40 font-medium leading-relaxed">
                        Интеллектуальный анализатор автоматически вырезает длинные паузы и тишину из видео для повышения динамики и удержания внимания зрителей.
                    </p>
                </div>

                <div className="h-px bg-white/5 w-full" />

                {/* Auto B-Roll */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20 text-blue-500">
                                <Image className="w-5 h-5" />
                            </div>
                            <h4 className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.2em] leading-tight">Авто B-roll</h4>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={settings.vizard_auto_broll === '1'} 
                                onChange={(e) => setSettings({...settings, vizard_auto_broll: e.target.checked ? '1' : '0'})}
                                className="sr-only peer" 
                            />
                            <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>
                    
                    <div className="space-y-4">
                        <p className="text-[11px] md:text-sm text-white/40 font-medium leading-relaxed">
                            Автоматическая подстановка релевантных стоковых футажей во время пауз или для визуальной иллюстрации речи. 
                        </p>
                        <div className="flex items-center gap-2 bg-blue-600/5 border border-blue-600/10 py-2 px-3 rounded-xl w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest leading-none">
                                Увеличивает время обработки
                            </span>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full relative group/btn overflow-hidden rounded-2xl"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 opacity-100 group-hover/btn:scale-110 transition-transform duration-500 shadow-xl shadow-blue-600/20" />
                        <div className="relative py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                                <CheckCircle className="w-4 h-4 text-white group-hover/btn:rotate-[360deg] transition-transform duration-700" />
                            )}
                            <span className="text-white font-black text-[10px] uppercase tracking-[0.3em]">
                                {saving ? 'Сохранение...' : 'Сохранить изменения Vizard'}
                            </span>
                        </div>
                    </button>
                </div>
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
