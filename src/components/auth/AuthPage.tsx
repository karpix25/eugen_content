import React, { useState, useEffect } from 'react';
import { RefreshCw, Send, Loader2 } from 'lucide-react';

interface AuthPageProps {
  onLogin: (token: string, user: any) => void;
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>("YOUR_BOT_USERNAME");
  const [isPolling, setIsPolling] = useState(false);
  const [waitingConfirm, setWaitingConfirm] = useState(false);

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

  const handleLoginClick = () => {
    if (sessionId) {
      setWaitingConfirm(true);
      const url = `https://t.me/${botUsername}?start=login_${sessionId}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent)]">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(16,185,129,0.3)] rotate-12 hover:rotate-0 transition-transform duration-500">
            <RefreshCw className="w-10 h-10 text-black animate-spin-slow" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">CONTENT<span className="text-emerald-500">MACHINE</span></h1>
          <p className="text-white/40 font-medium">Авторизуйтесь через Telegram для доступа к платформе</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-10 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div className="relative z-10 space-y-4">
            {!waitingConfirm ? (
              <>
                <button
                  onClick={handleLoginClick}
                  disabled={!sessionId}
                  className="w-full h-14 bg-[#229ED9] hover:bg-[#1f8ebf] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-[#229ED9]/20"
                >
                  <Send className="w-6 h-6 rotate-[-45deg]" />
                  <span>ВОЙТИ ЧЕРЕЗ TELEGRAM</span>
                </button>
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em]">Подтвердите вход в приложении</p>
              </>
            ) : (
              <div className="py-2 space-y-4">
                <div className="flex justify-center">
                  <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-white font-bold text-sm">Ждем подтверждения...</p>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Откройте Telegram и нажмите Start</p>
                </div>
                <button
                  onClick={() => setWaitingConfirm(false)}
                  className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider hover:underline"
                >
                  Вернуться назад
                </button>
              </div>
            )}
          </div>

          <div className="relative z-10 mt-6 pt-6 border-t border-white/5" />

          <button
            onClick={() => onLogin('dev-token', { id: 'dev', first_name: 'Developer', username: 'dev', is_admin: true })}
            className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-black transition-all relative z-20"
          >
            Войти как разработчик (Local Dev)
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Platform Secure Access
        </div>
      </div>
    </div>
  );
}
