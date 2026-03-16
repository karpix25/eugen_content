import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, AlertCircle, Loader2, Send } from 'lucide-react';

interface AuthProps {
  onLogin: (token: string, user: any) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);
  const [waitingConfirm, setWaitingConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        setBotUsername(config.bot_username || "YOUR_BOT_USERNAME");

        const sessionRes = await fetch('/api/auth/init');
        const sessionData = await sessionRes.json();
        setSessionId(sessionData.sessionId);
        setIsPolling(true);
      } catch (err) {
        console.error("Failed to init auth:", err);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!sessionId || !isPolling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/check/${sessionId}`);
        const data = await res.json();

        if (data.status === 'authorized') {
          setIsPolling(false);
          clearInterval(interval);
          onLogin(data.token, data.user);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, isPolling, onLogin]);

  const handleTelegramLogin = () => {
    if (sessionId) {
      setWaitingConfirm(true);
      const url = `https://t.me/${botUsername}?start=login_${sessionId}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#0A0A0A]">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] mb-6 shadow-2xl shadow-blue-600/20 group">
            <div className="w-full h-full rounded-[2rem] bg-black flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
               <Shield className="w-8 h-8 text-blue-500 relative z-10" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tighter">
            EUGEN<span className="text-blue-600">.</span>CONTROL
          </h1>
          <p className="text-white/40 font-medium uppercase tracking-[0.3em] text-[10px]">Система управления контентом</p>
        </div>

        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4">
            <Sparkles className="w-5 h-5 text-blue-600/20" />
          </div>

          <div className="space-y-6">
            {!waitingConfirm ? (
              <div className="space-y-6">
                <div className="text-center space-y-2 mb-4">
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Авторизация через Telegram</p>
                </div>
                
                <button
                  type="button"
                  onClick={handleTelegramLogin}
                  disabled={!sessionId}
                  className="w-full bg-[#229ED9] hover:bg-[#1E8EC2] text-white font-black uppercase tracking-[0.2em] py-6 rounded-2xl transition-all shadow-xl shadow-[#229ED9]/20 flex items-center justify-center gap-3 relative overflow-hidden group active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <Send className="w-6 h-6 relative z-10 rotate-[-45deg]" />
                  <span className="relative z-10 text-lg">Войти через Telegram</span>
                </button>
              </div>
            ) : (
              <div className="p-8 bg-black/40 border border-white/10 rounded-[2rem] text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-12 h-12 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                </div>
                <div className="space-y-2">
                  <p className="text-white font-black uppercase tracking-[0.2em] text-xs">Ждем подтверждения</p>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold leading-relaxed">
                    Откройте Telegram и нажмите кнопку <span className="text-blue-600">ЗАПУСТИТЬ</span> (START) в боте
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaitingConfirm(false)}
                  className="w-full py-3 border border-white/5 rounded-xl text-white/20 text-[10px] font-black uppercase tracking-widest hover:text-white/40 hover:bg-white/5 transition-all"
                >
                  Вернуться назад
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

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
