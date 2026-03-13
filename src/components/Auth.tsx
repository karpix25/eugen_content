import React, { useState } from 'react';
import { Shield, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

interface AuthProps {
  onLogin: (token: string) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [userLogin, setUserLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userLogin, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('authToken', data.token);
        onLogin(data.token);
      } else {
        setError(data.error || 'Ошибка входа');
      }
    } catch (e) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#0A0A0A]">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-emerald-400 to-emerald-600 p-[1px] mb-6 shadow-2xl shadow-emerald-500/20 group">
            <div className="w-full h-full rounded-[2rem] bg-black flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
               <Shield className="w-8 h-8 text-emerald-400 relative z-10" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tighter">
            EUGEN<span className="text-emerald-500">.</span>CONTROL
          </h1>
          <p className="text-white/40 font-medium uppercase tracking-[0.3em] text-[10px]">Система управления контентом</p>
        </div>

        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4">
            <Sparkles className="w-5 h-5 text-emerald-500/20" />
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Логин</label>
              <input
                type="text"
                value={userLogin}
                onChange={(e) => setUserLogin(e.target.value)}
                autoFocus
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:border-emerald-500 outline-none transition-all font-medium"
                placeholder="userName"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:border-emerald-500 outline-none transition-all font-medium"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 relative overflow-hidden group active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="relative z-10">Войти в систему</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">v2.5.0 build 2024</p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-white/20 text-[10px] font-medium leading-relaxed max-w-[280px] mx-auto">
            Доступ только для авторизованных пользователей проекта KarPix
          </p>
        </div>
      </div>
    </div>
  );
}
