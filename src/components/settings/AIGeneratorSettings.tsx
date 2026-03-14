import React, { useState } from 'react';
import { Bot, Loader2, Sparkles, Wand2, RefreshCw } from 'lucide-react';

interface AIGeneratorSettingsProps {
  authToken: string;
  onUpdate: () => void;
}

export function AIGeneratorSettings({ authToken, onUpdate }: AIGeneratorSettingsProps) {
  const [topic, setTopic] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/ad-plaques/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ topic, name: name || topic })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate plaque');
      }

      setSuccess(true);
      const data = await response.json();
      setGeneratedUrl(data.imageUrl);
      setTopic('');
      setName('');
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-1000" />
      
      <div className="relative space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Bot className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">AI Генератор Плашек</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Создавайте уникальный дизайн с помощью ИИ</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">О чем должна быть плашка?</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Например: Скидка 50% на все кроссовки Nike, яркий дизайн, неоновые цвета..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 outline-none transition-all min-h-[120px] resize-none placeholder:text-white/10"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Название (необязательно)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nike Promo Plaque"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 outline-none transition-all placeholder:text-white/10"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {success && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 text-xs font-bold">
                Плашка успешно сгенерирована и сохранена!
              </div>
              {generatedUrl && (
                <div className="relative group/preview rounded-2xl overflow-hidden border border-white/10 aspect-[3/2] bg-black/40">
                  <img src={generatedUrl} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center p-6 text-center">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest leading-relaxed">
                      Эта плашка уже доступна в разделе «Настройки плашек»
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !topic}
            className="w-full py-5 rounded-[2rem] bg-emerald-500 text-black font-black uppercase tracking-[0.25em] text-[10px] hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95 group relative overflow-hidden"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Wand2 className="w-5 h-5 transition-transform group-hover:rotate-12" />
                <span>Сгенерировать</span>
              </>
            )}
            
            {loading && (
              <div className="absolute inset-0 bg-emerald-400/20 animate-pulse" />
            )}
          </button>
        </form>

        <div className="pt-4 grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-relaxed">Используются SOTA модели для генерации графики</p>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-relaxed">Результат сразу доступен в настройках плашек</p>
          </div>
        </div>
      </div>
    </div>
  );
}
