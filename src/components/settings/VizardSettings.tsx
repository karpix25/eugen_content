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
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none group-hover:bg-purple-600/20 transition-colors duration-1000" />
      
      <div className="relative space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center border border-purple-600/20">
            <Scissors className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Настройки Vizard AI</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Параметры интеллектуальной нарезки клипов</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preferred Length */}
            <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-purple-500" />
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Длина клипов</h4>
                </div>
                <select 
                    value={settings.vizard_prefer_length}
                    onChange={(e) => setSettings({...settings, vizard_prefer_length: e.target.value})}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors font-bold"
                >
                    <option value="1">До 30 секунд</option>
                    <option value="2">30 - 60 секунд</option>
                    <option value="3">60 - 90 секунд</option>
                    <option value="4">Менее 90 секунд</option>
                </select>
                <div className="flex items-start gap-2 text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
                    <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>Определяет предпочтительный временной интервал для создаваемых клипов.</span>
                </div>
            </div>

            {/* Silence Removal */}
            <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <VolumeX className="w-4 h-4 text-purple-500" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Удаление тишины</h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={settings.vizard_remove_silence === '1'} 
                            onChange={(e) => setSettings({...settings, vizard_remove_silence: e.target.checked ? '1' : '0'})}
                            className="sr-only peer" 
                        />
                        <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
                    Автоматически вырезает длинные паузы и тишину из видео для повышения динамики.
                </p>
            </div>

            {/* Auto B-Roll */}
            <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-purple-500" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Авто B-roll</h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={settings.vizard_auto_broll === '1'} 
                            onChange={(e) => setSettings({...settings, vizard_auto_broll: e.target.checked ? '1' : '0'})}
                            className="sr-only peer" 
                        />
                        <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
                    Автоматическая подстановка релевантных футажей (сток видео) во время пауз или для иллюстрации речи. (Может увеличить время обработки)
                </p>
            </div>

            {/* Save Button */}
            <div className="flex flex-col justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-black text-xs uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-purple-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ НАСТРОЙКИ'}
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
