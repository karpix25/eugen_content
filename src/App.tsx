/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Youtube,
  Search,
  CheckCircle,
  XCircle,
  Play,
  Settings,
  Plus,
  RefreshCw,
  BarChart3,
  Video,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  Loader2,
  ClipboardList,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Send,
  Download,
  Menu,
  X,
  Trash2,
  Users,
  LogOut,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';

interface Channel {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: number;
  monitoring_interval?: string;
  next_check?: string;
}

interface VideoData {
  id: string;
  channel_id: string;
  title: string;
  description: string;
  published_at: string;
  thumbnail: string;
  ai_score: number | null;
  ai_evaluation: string | null;
  detected_language: string | null;
  target_language: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'sent_to_vizard' | 'completed';
}

interface Clip {
  id: string;
  video_id: string;
  url: string;
  thumbnail: string;
  title: string;
  status: 'raw' | 'processed';
  ad_plaque_id: string | null;
  is_available: boolean;
  downloaded_by?: string;
  downloaded_at?: string;
  transcript: string;
  language: string | null;
  published_by_me?: boolean;
}

interface Publication {
  id: string;
  clip_id: string;
  user_id: string;
  username?: string;
  first_name?: string;
  clip_title?: string;
  clip_thumbnail?: string;
  social_links: string[];
  status: 'sent' | 'published';
  created_at: string;
}

interface User {
  telegram_id: string;
  username: string;
  first_name: string;
  is_authorized: boolean;
  is_admin: boolean;
  created_at: string;
  publication_count?: number;
  published_links?: string[];
  watermark_text?: string;
  watermark_opacity?: number;
  watermark_position?: string;
  subtitle_enabled?: boolean;
  subtitle_font_size?: number;
  subtitle_font_color?: string;
  subtitle_position?: string;
  subtitle_style?: string;
  subtitle_font_family?: string;
  subtitle_highlight_color?: string;
  subtitle_highlight_enabled?: boolean;
  subtitle_outline_color?: string;
  default_plaque_id?: string | null;
  plaque_position?: string;
}

interface AdPlaque {
  id: string;
  name: string;
  image_url: string;
  text: string;
}

interface Task {
  id: string;
  clip_id: string;
  description: string;
  status: 'pending' | 'completed';
  published_link: string | null;
  created_at: string;
  clip_url: string;
  clip_thumbnail: string;
  clip_title: string;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

function AuthPage({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>("YOUR_BOT_USERNAME");
  const [isPolling, setIsPolling] = useState(false);
  const [waitingConfirm, setWaitingConfirm] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get config
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        setBotUsername(config.bot_username || "YOUR_BOT_USERNAME");

        // Init session
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'tasks' | 'clips' | 'ads' | 'workers' | 'publications' | 'settings'>('clips');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newChannelId, setNewChannelId] = useState('');
  const [monitoringInterval, setMonitoringInterval] = useState('daily');
  const [scrapeDays, setScrapeDays] = useState(7);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [plaques, setPlaques] = useState<AdPlaque[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetAudience, setTargetAudience] = useState('Предприниматели, интересующиеся ИИ и автоматизацией');

  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'ru' | 'en'>('all');

  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    if (authToken) {
      fetchData();
    } else {
      setIsAuthChecking(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (currentUser && !currentUser.is_admin && !['clips', 'ads', 'settings'].includes(activeTab)) {
      setActiveTab('clips');
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    if (!authToken) return;
    const hasPending = videos.some(v => v.status === 'pending' && !v.ai_evaluation);
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [videos, authToken]);

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('auth_token');
  };

  const fetchData = async () => {
    const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
    try {
      const [chRes, vidRes, clipRes, adRes, taskRes, userRes, pubRes] = await Promise.all([
        fetch('/api/channels', { headers }),
        fetch('/api/videos', { headers }),
        fetch('/api/clips', { headers }),
        fetch(`/api/ad-plaques${currentUser ? `?user_id=${currentUser.id}` : ''}`, { headers }),
        fetch('/api/tasks', { headers }),
        fetch('/api/users', { headers }),
        currentUser?.is_admin ? fetch('/api/admin/publications', { headers }) : Promise.resolve({ json: () => [] })
      ]);

      const resData = await Promise.all([
        chRes.json(),
        vidRes.json(),
        clipRes.json(),
        adRes.json(),
        taskRes.json(),
        userRes.json(),
        pubRes.json()
      ]);

      if (resData.some(d => d.error === 'Unauthorized' || d === 401)) {
        handleLogout();
        setIsAuthChecking(false);
        return;
      }

      setChannels(Array.isArray(resData[0]) ? resData[0] : []);
      setVideos(Array.isArray(resData[1]) ? resData[1] : []);
      setClips(Array.isArray(resData[2]) ? resData[2] : []);
      setPlaques(Array.isArray(resData[3]) ? resData[3] : []);
      setTasks(Array.isArray(resData[4]) ? resData[4] : []);
      setUsers(Array.isArray(resData[5]) ? resData[5] : []);
      setPublications(Array.isArray(resData[6]) ? resData[6] : []);


      // If we got here, we're authorized. Let's explicitly check who we are if we don't know yet
      if (!currentUser) {
        try {
          const authCheck = await fetch('/api/auth/check', { headers });
          if (authCheck.ok) {
            const userData = await authCheck.json();
            setCurrentUser(userData.user);
          }
        } catch (e) {
          console.error("Auth check failed", e);
        }
      }

      setIsAuthChecking(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsAuthChecking(false);
    }
  };

  const handleAuthorize = async (id: string, authorize: boolean) => {
    try {
      await fetch(`/api/users/${id}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorize })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChannel = async () => {
    if (!newChannelId) return;
    setLoading(true);
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: newChannelId, monitoring_interval: monitoringInterval, scrapeDays })
      });

      if (response.ok) {
        setNewChannelId('');
        fetchData();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to add channel");
      }
    } catch (err) {
      alert("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm("Удалить этот канал? Будут также удалены все связанные видео и клипы.")) return;
    try {
      await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMonitor = async () => {
    setLoading(true);
    try {
      await fetch('/api/monitor', { method: 'POST' });
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (id: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/videos/${id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAudience })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        alert(err?.error || "Ошибка генерации оценки ИИ (проверьте баланс и ключ OpenRouter)");
      }
      await fetchData();
    } catch (err) {
      alert("Ошибка сети при обращении к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, targetLanguage?: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/videos/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_language: targetLanguage })
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.error || "Ошибка при отправке в Vizard");
      }
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при обращении к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteVideo = async (id: string) => {
    if (!confirm("Отметить это видео как отработанное? (Оно уйдет в статус 'Готово')")) return;
    setLoading(true);
    try {
      await fetch(`/api/videos/${id}/complete`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (clipId: string) => {
    const description = prompt("Введите описание для публикации:");
    if (!description) return;

    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: clipId, description })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitTask = async (taskId: string, link: string) => {
    if (!link) return;
    try {
      await fetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published_link: link })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePlaque = async (id: string) => {
    if (!confirm("Удалить эту плашку?")) return;
    try {
      await fetch(`/api/ad-plaques/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPlaque = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (currentUser?.id) {
      formData.append('user_id', currentUser.id);
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ad-plaques', {
        method: 'POST',
        body: formData // Using FormData directly for file upload
      });

      if (response.ok) {
        fetchData();
        (e.target as HTMLFormElement).reset();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to upload plaque");
      }
    } finally {
      setLoading(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
          <Zap className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Загрузка системы...</h2>
        <p className="text-white/40 text-sm">Проверяем доступы и подключаемся к серверу</p>
      </div>
    );
  }

  if (!authToken) {
    return <AuthPage onLogin={(token, user) => {
      setAuthToken(token);
      setCurrentUser(user);
      localStorage.setItem('auth_token', token);
    }} />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 bottom-0 w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl z-50 flex flex-col transition-transform duration-300 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "translate-x-[-100%]"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <RefreshCw className="w-6 h-6 text-black animate-spin-slow" />
          </div>
          <span className="font-bold text-xl tracking-tight">ContentMachine</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {currentUser?.is_admin && (
            <NavButton
              active={activeTab === 'monitor'}
              onClick={() => setActiveTab('monitor')}
              icon={<Youtube className="w-5 h-5" />}
              label="Мониторинг"
            />
          )}
          <NavButton
            active={activeTab === 'clips'}
            onClick={() => setActiveTab('clips')}
            icon={<Video className="w-5 h-5" />}
            label="Нарезки"
          />
          <NavButton
            active={activeTab === 'ads'}
            onClick={() => setActiveTab('ads')}
            icon={<ImageIcon className="w-5 h-5" />}
            label="Меню плашек"
          />
          <NavButton
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            icon={<Settings className="w-5 h-5" />}
            label="Настройки"
          />
          {currentUser?.is_admin && (
            <>
              <NavButton
                active={activeTab === 'tasks'}
                onClick={() => setActiveTab('tasks')}
                icon={<ClipboardList className="w-5 h-5" />}
                label="Задания"
              />
              <NavButton
                active={activeTab === 'workers'}
                onClick={() => setActiveTab('workers')}
                icon={<Users className="w-5 h-5" />}
                label="Работники"
              />
              <NavButton
                active={activeTab === 'publications'}
                onClick={() => setActiveTab('publications')}
                icon={<ExternalLink className="w-5 h-5" />}
                label="Публикации"
              />
            </>
          )}

        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-black">
              {currentUser?.first_name?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser?.first_name || 'Admin User'}</p>
              <p className="text-xs text-white/40 truncate">@{currentUser?.username || 'admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors group"
              title="Выйти"
            >
              <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen max-w-full overflow-x-hidden">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-lg md:text-2xl font-semibold truncate">
              {activeTab === 'monitor' && 'Мониторинг YouTube'}
              {activeTab === 'clips' && 'Готовые нарезки'}
              {activeTab === 'ads' && 'Меню плашек'}
              {activeTab === 'tasks' && 'Задания на публикацию'}
              {activeTab === 'workers' && 'Работники'}
              {activeTab === 'publications' && 'Публикации'}
              {activeTab === 'settings' && 'Настройки'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === 'monitor' && (
              <button
                onClick={handleMonitor}
                disabled={loading}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Проверить новые
              </button>
            )}
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'monitor' && (
            <div className="space-y-8">
              {/* Target Audience Config */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <label className="block text-sm font-medium text-white/60 mb-2 uppercase tracking-wider">Целевая аудитория для ИИ</label>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-24"
                  placeholder="Опишите вашу ЦА..."
                />
              </div>

              {/* Channels */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center gap-4">
                  <h3 className="font-medium flex items-center gap-2 text-white/60">
                    <Plus className="w-4 h-4" /> Добавить канал
                  </h3>
                  <div className="flex flex-col gap-3">
                    <input
                      value={newChannelId}
                      onChange={(e) => setNewChannelId(e.target.value)}
                      placeholder="YouTube URL или ID"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        value={monitoringInterval}
                        onChange={(e) => setMonitoringInterval(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm flex-1"
                      >
                        <option value="daily">Каждый день</option>
                        <option value="weekly">Каждую неделю</option>
                        <option value="manual">Вручную</option>
                      </select>
                      <div className="flex bg-black/40 border border-white/10 rounded-lg overflow-hidden flex-1 focus-within:border-emerald-500">
                        <input
                          type="number"
                          min="0"
                          value={scrapeDays}
                          onChange={(e) => setScrapeDays(parseInt(e.target.value) || 0)}
                          className="w-full bg-transparent px-3 py-2 outline-none text-sm"
                          title="Дней назад (0 = все)"
                          placeholder="Дней"
                        />
                        <span className="text-white/40 text-xs px-3 py-2 bg-white/5 border-l border-white/10 flex items-center">дн.</span>
                      </div>
                    </div>
                    <button
                      onClick={handleAddChannel}
                      disabled={loading}
                      className="w-full bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-white/90 disabled:opacity-50 text-sm"
                    >
                      {loading ? "Загрузка..." : "Добавить"}
                    </button>
                  </div>
                </div>
                {channels.map(channel => (
                  <div key={channel.id} className="relative bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4 group hover:bg-white/10 transition-colors">
                    <img src={channel.thumbnail} className="w-12 h-12 rounded-full border border-white/10 object-cover" alt="" />
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-medium truncate">{channel.name}</h3>
                        {channel.subscribers !== undefined && (
                          <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                            {formatNumber(channel.subscribers)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-white/40">
                          {channel.monitoring_interval === 'daily' ? 'Ежедневно' : channel.monitoring_interval === 'weekly' ? 'Еженедельно' : 'Вручную'}
                        </span>
                        <p className="text-[10px] text-white/20 truncate">{channel.id}</p>
                      </div>
                      {channel.next_check && (
                        <p className="text-[10px] text-emerald-500/60 mt-1">
                          След. проверка: {format(new Date(channel.next_check), 'dd.MM HH:mm')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                      title="Удалить канал"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Video List */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" /> Последние видео
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  {videos.map(video => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onEvaluate={() => handleEvaluate(video.id)}
                      onApprove={(targetLanguage?: string) => handleApprove(video.id, targetLanguage)}
                      onComplete={() => handleCompleteVideo(video.id)}
                      loading={loading}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clips' && (() => {
            const visibleClips = clips.filter(c => {
              // Availability filter
              const statusMatch = showAvailableOnly ? c.is_available === true : true;

              // Language filter
              let langMatch = true;
              if (languageFilter !== 'all') {
                langMatch = c.language === languageFilter;
              }

              return statusMatch && langMatch;
            });

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex">
                      <button
                        onClick={() => setShowAvailableOnly(true)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                          showAvailableOnly ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white"
                        )}
                      >
                        Свободные клипы
                      </button>
                      <button
                        onClick={() => setShowAvailableOnly(false)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                          !showAvailableOnly ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white"
                        )}
                      >
                        Все клипы
                      </button>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex items-center">
                      <button
                        onClick={() => setLanguageFilter('all')}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", languageFilter === 'all' ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5")}
                      >
                        Все 🌍
                      </button>
                      <div className="w-px h-4 bg-white/10 mx-1"></div>
                      <button
                        onClick={() => setLanguageFilter('ru')}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", languageFilter === 'ru' ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5")}
                      >
                        RU 🇷🇺
                      </button>
                      <button
                        onClick={() => setLanguageFilter('en')}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", languageFilter === 'en' ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5")}
                      >
                        EN 🇺🇸
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {visibleClips.map(clip => (
                    <ClipCard
                      key={clip.id}
                      clip={clip}
                      plaques={plaques}
                      currentUserProfile={currentUser}
                      onCreateTask={() => handleCreateTask(clip.id)}
                      onSendToTelegram={async (clipId, plaqueId) => {
                        try {
                          const head = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
                          const payload: any = { plaque_id: plaqueId };
                          const r = await fetch(`/api/clips/${clipId}/apply-plaque`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...head },
                            body: JSON.stringify(payload)
                          });
                          if (!r.ok) {
                            const e = await r.json();
                            alert(e.error || "Ошибка при генерации");
                          } else {
                            alert("Видео успешно отправлено вам в Telegram!");
                            fetchData();
                          }
                        } catch (e) {
                          alert("Ошибка сети при отправке видео");
                        }
                      }}
                    />
                  ))}
                  {visibleClips.length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/20">
                      <Video className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Подходящих нарезок пока нет.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'ads' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-24">
                  <h3 className="text-lg font-medium mb-4">Загрузить новую плашку</h3>
                  <form onSubmit={handleAddPlaque} className="space-y-4">
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Название (для себя)</label>
                      <input name="name" required placeholder="Напр: Скидка 20%" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Файл изображения (PNG/JPG)</label>
                      <input type="file" name="file" accept="image/*" required className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Текст на плашке (CTA)</label>
                      <input name="text" required placeholder="Напр: Жми по ссылке в профиле!" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500" />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-500 text-black py-2 rounded-lg font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {loading ? "Загрузка..." : "Добавить в меню"}
                    </button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plaques.map(plaque => (
                    <div key={plaque.id} className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 items-center relative overflow-hidden">
                      <img src={plaque.image_url} className="w-20 h-20 rounded-lg object-cover bg-black shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{plaque.name}</h4>
                        <p className="text-sm text-white/40 truncate">{plaque.text}</p>
                      </div>
                      <button
                        onClick={() => handleDeletePlaque(plaque.id)}
                        className="p-2 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {plaques.length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/20 border-2 border-dashed border-white/5 rounded-2xl">
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>В меню пока нет плашек. Загрузите первую!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {tasks.map(task => (
                  <TaskCard key={task.id} task={task} onSubmit={(link) => handleSubmitTask(task.id, link)} />
                ))}
              </div>
              {tasks.length === 0 && (
                <div className="py-20 text-center text-white/20">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Заданий пока нет. Создайте задание из раздела "Нарезки".</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'workers' && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Пользователь</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Telegram ID</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40 text-center">Всего видео</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Статус</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(user => (
                      <tr key={user.telegram_id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-emerald-400">{user.first_name}</div>
                          <div className="text-xs text-white/40">@{user.username || 'n/a'}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-white/60">{user.telegram_id}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setSelectedWorker(user)}
                            className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-full transition-all"
                          >
                            <span className="font-bold text-sm text-white">{user.publication_count || 0}</span>
                            <ChevronRight className="w-3 h-3 text-white/40 group-hover:text-emerald-500 transition-colors" />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {user.is_authorized ? (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold uppercase">Авторизован</span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-bold uppercase">В ожидании</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => handleAuthorize(user.telegram_id, !user.is_authorized)}
                              className={cn(
                                "px-3 py-1 rounded text-xs font-bold transition-colors",
                                user.is_authorized ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-emerald-500 text-black hover:bg-emerald-400"
                              )}
                            >
                              {user.is_authorized ? "Деавторизовать" : "Авторизовать"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="py-20 text-center text-white/20">
                    <p>Пользователей пока нет. Работники должны нажать /start в боте.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'publications' && <PublicationsTab publications={publications} />}
          {activeTab === 'settings' && currentUser && authToken && (
            <SettingsTab
              currentUser={currentUser}
              authToken={authToken}
              onUpdate={fetchData}
              plaques={plaques}
              onAddPlaque={handleAddPlaque}
              onDeletePlaque={handleDeletePlaque}
            />
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedWorker && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-lg font-bold text-emerald-500 border border-emerald-500/20">
                    {selectedWorker.first_name[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedWorker.first_name}</h3>
                    <p className="text-white/40 text-sm">@{selectedWorker.username || 'n/a'} • {selectedWorker.publication_count || 0} видео</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWorker(null)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <PublicationsTab
                  publications={publications.filter(p => p.user_id === selectedWorker.telegram_id)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VideoCard({ video, onEvaluate, onApprove, onComplete, loading }: {
  video: VideoData,
  onEvaluate: () => void,
  onApprove: (targetLanguage?: string) => void,
  onComplete: () => void,
  loading: boolean
}) {
  const [showDubModal, setShowDubModal] = useState(false);

  const getDubbingOptions = () => {
    if (video.detected_language === 'ru') {
      return [
        { label: 'Без дубляжа (Оригинал: RU)', value: undefined },
        { label: 'Дублировать на Английский (EN)', value: 'en' }
      ];
    } else if (video.detected_language === 'en') {
      return [
        { label: 'Без дубляжа (Оригинал: EN)', value: undefined },
        { label: 'Дублировать на Русский (RU)', value: 'ru' }
      ];
    }
    // Fallback if language is unknown
    return [
      { label: 'Без дубляжа (Оригинальная дорожка)', value: undefined },
      { label: 'Дублировать на Русский (RU)', value: 'ru' },
      { label: 'Дублировать на Английский (EN)', value: 'en' }
    ];
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col sm:flex-row min-w-0"
      >
        <div className="relative w-full sm:w-64 md:w-72 aspect-video shrink-0">
          <img src={video.thumbnail} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="p-3 bg-white/20 backdrop-blur-md rounded-full">
              <ExternalLink className="w-6 h-6" />
            </a>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col">
          <div className="flex justify-between items-start gap-4 mb-2">
            <h3 className="font-semibold text-lg leading-tight">{video.title}</h3>
            {video.ai_score !== null && (
              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-bold",
                video.ai_score > 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"
              )}>
                {video.ai_score}% Match
              </div>
            )}
          </div>

          <p className="text-sm text-white/40 line-clamp-2 mb-4">{video.description}</p>

          <div className="mt-auto flex flex-wrap items-center gap-4">
            {!video.ai_evaluation ? (
              <button
                onClick={onEvaluate}
                disabled={loading}
                title="Перезапустить анализ, если он завис"
                className="text-xs text-yellow-500/80 hover:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 px-3 py-1 rounded-full flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Анализ ИИ...
              </button>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/40 mb-1 uppercase tracking-widest font-bold">Оценка ИИ:</div>
                <div className="text-sm text-white/80 bg-black/20 p-3 rounded-lg">
                  <Markdown>{video.ai_evaluation}</Markdown>
                </div>
              </div>
            )}

            {video.ai_evaluation && video.status === 'pending' && (
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={onComplete}
                  title="Отметить как готовое"
                  className="p-2 bg-white/10 text-white/60 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <CheckCircle className="w-5 h-5 text-white/40" />
                </button>
                <button
                  onClick={() => setShowDubModal(true)}
                  disabled={loading}
                  className={cn(
                    "p-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors",
                    loading && "opacity-50 cursor-not-allowed"
                  )}
                  title="Одобрить и выбрать язык"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            )}

            {video.status === 'approved' && (
              <div className="ml-auto flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  В обработке Vizard...
                </div>
                {video.target_language && (
                  <div className="text-[10px] uppercase font-bold text-emerald-500/60 tracking-wider">
                    Запланирован дубляж: {video.target_language}
                  </div>
                )}
              </div>
            )}

            {video.status === 'completed' && (
              <div className="ml-auto flex flex-col items-end gap-1">
                <div className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Готово
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showDubModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 relative"
            >
              <button
                onClick={() => setShowDubModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h3 className="text-xl font-bold">Выберите язык</h3>
                <p className="text-sm text-white/40">Определен язык оригинала: <strong className="text-emerald-400 uppercase">{video.detected_language || 'Неизвестен'}</strong></p>
              </div>

              <div className="space-y-2 pt-2">
                {getDubbingOptions().map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setShowDubModal(false);
                      onApprove(opt.value);
                    }}
                    className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/50 transition-all font-medium text-sm flex items-center justify-between group"
                  >
                    {opt.label}
                    <CheckCircle className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>

              <p className="text-xs text-white/30 text-center pt-2">
                Выбор дубляжа автоматически отправит клипы в ElevenLabs после нарезки в Vizard.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
function ClipCard({ clip, plaques, onCreateTask, onSendToTelegram, currentUserProfile }: { clip: Clip, plaques: AdPlaque[], onCreateTask: () => void, onSendToTelegram?: (clipId: string, plaqueId: string | null) => void, currentUserProfile?: any }) {
  const [randomPlaque, setRandomPlaque] = useState<AdPlaque | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlaqueSelector, setShowPlaqueSelector] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const applyRandomPlaque = () => {
    if (plaques.length === 0) return;
    const r = plaques[Math.floor(Math.random() * plaques.length)];
    setRandomPlaque(r);
  };

  const handleSend = async (plaqueId: string | null) => {
    if (!onSendToTelegram) return;
    setShowPlaqueSelector(false);
    setIsSending(true);
    try {
      await onSendToTelegram(clip.id, plaqueId);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300">
        <div className="aspect-[9/16] bg-black relative overflow-hidden">
          {!isPlaying ? (
            <>
              {clip.thumbnail ? (
                <img src={clip.thumbnail} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
              ) : (
                <video
                  src={clip.url + '#t=0.1'}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <button
                  onClick={() => setIsPlaying(true)}
                  className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                >
                  <Play className="w-8 h-8 fill-current ml-1" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-full relative">
              <video
                src={clip.url}
                className="w-full h-full object-cover"
                controls
                autoPlay
                onEnded={() => setIsPlaying(false)}
              />
              <button
                onClick={() => setIsPlaying(false)}
                className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white/80 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Ad Plaque Overlay Simulation */}
          <AnimatePresence>
            {randomPlaque && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute bottom-12 left-4 right-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-3 flex items-center gap-3 shadow-2xl z-20"
              >
                <img src={randomPlaque.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-tighter">Реклама</p>
                  <p className="text-xs font-medium truncate">{randomPlaque.text}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {clip.published_by_me && (
            <div className="absolute top-3 left-3 z-30 pointer-events-none">
              <span className="px-2 py-1 bg-emerald-500/90 backdrop-blur-md text-black rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
                <CheckCircle className="w-3 h-3" /> Отправлено
              </span>
            </div>
          )}

          {!clip.is_available && (
            <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
              <XCircle className="w-12 h-12 text-red-500 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Уже скачано</p>
              <p className="text-sm font-medium text-emerald-400">{clip.downloaded_by || 'Кто-то'}</p>
            </div>
          )}
          {isSending && (
            <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="w-10 h-10 text-emerald-500 mb-3 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Рендеринг и отправка...</p>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-sm text-white line-clamp-2 leading-snug" title={clip.title}>
              {clip.title}
            </h4>
            {clip.language && (
              <span className="text-xs shrink-0 px-2 py-1 bg-white/10 rounded-md font-bold uppercase tracking-wider text-white/70" title={`Язык: ${clip.language}`}>
                {clip.language === 'ru' ? '🇷🇺' : clip.language === 'en' ? '🇺🇸' : clip.language}
              </span>
            )}
          </div>

          {clip.transcript && (
            <div className="mb-4 bg-black/20 rounded-lg p-2 border border-white/5">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Transcript</p>
              <p className="text-[11px] text-white/60 leading-relaxed line-clamp-3 select-all">
                {clip.transcript}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowPlaqueSelector(true)}
              disabled={!clip.is_available || isSending || !onSendToTelegram}
              className="flex-1 text-[11px] uppercase tracking-widest font-black py-3 bg-[#229ED9] text-white rounded-xl hover:bg-[#1f8ebf] transition-all shadow-[0_4px_20px_rgba(34,158,217,0.2)] disabled:opacity-30 flex items-center justify-center gap-2"
            >
              <Send className="w-3 h-3" /> {clip.published_by_me ? 'Отправить еще раз' : 'В Telegram с плашкой'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onCreateTask()}
                disabled={!clip.is_available}
                className="flex-1 text-[10px] uppercase tracking-widest font-black py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                <ClipboardList className="w-3 h-3" /> Задача
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPlaqueSelector && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 relative max-h-[80vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowPlaqueSelector(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1 mb-2">
                <h3 className="text-xl font-bold">Выберите плашку</h3>
                <p className="text-sm text-white/40">Какую рекламу наложить на это видео?</p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleSend(null)}
                  className="w-full p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/50 transition-all flex items-center justify-center gap-3 group mb-2"
                >
                  <Send className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs uppercase tracking-widest text-emerald-500">Отправить без плашки</span>
                </button>

                <div className="relative py-2 px-1 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <span className="relative bg-[#111] px-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">или выберите</span>
                </div>

                {plaques.length === 0 && (
                  <p className="text-center text-[10px] text-white/30 py-4 font-medium uppercase tracking-widest leading-loose px-4">
                    Нет добавленных плашек.<br />
                    Вы можете создать их во вкладке «Меню плашек».
                  </p>
                )}
                {plaques.map((plaque) => (
                  <button
                    key={plaque.id}
                    onClick={() => handleSend(plaque.id)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/50 transition-all flex items-center gap-4 group"
                  >
                    <img src={plaque.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-white group-hover:text-emerald-400 transition-colors">{plaque.name}</p>
                      <p className="text-[10px] text-white/40 truncate">{plaque.text}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function TaskCard({ task, onSubmit }: { task: Task, onSubmit: (link: string) => void }) {
  const [link, setLink] = useState('');

  const handleDownload = () => {
    // In a real app, this would trigger a download of the clip_url
    // For now, we'll open it in a new tab
    window.open(task.clip_url, '_blank');
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col sm:flex-row min-w-0">
      <div className="w-full sm:w-40 md:w-48 aspect-[9/16] bg-black relative shrink-0">
        <img src={task.clip_thumbnail} className="w-full h-full object-cover opacity-60" alt="" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="w-8 h-8 text-white/40" />
        </div>
        <button
          onClick={handleDownload}
          className="absolute bottom-3 right-3 p-2 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors group"
          title="Скачать видео"
        >
          <Download className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
        </button>
      </div>

      <div className="flex-1 p-4 md:p-6 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-4 gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-base md:text-lg truncate">{task.clip_title}</h3>
            <p className="text-[10px] md:text-xs text-white/40">{format(new Date(task.created_at), 'dd.MM.yyyy HH:mm')}</p>
          </div>
          <div className={cn(
            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shrink-0",
            task.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"
          )}>
            {task.status === 'completed' ? 'Выполнено' : 'В работе'}
          </div>
        </div>

        <div className="bg-black/20 p-3 md:p-4 rounded-xl mb-4 md:mb-6 flex-1 overflow-y-auto max-h-32">
          <p className="text-[10px] text-white/40 mb-1 uppercase font-bold tracking-widest">Описание для поста:</p>
          <p className="text-xs md:text-sm text-white/80 whitespace-pre-wrap break-words">{task.description}</p>
        </div>

        {task.status === 'pending' ? (
          <div className="mt-auto space-y-3">
            <div className="flex flex-col xl:flex-row gap-2">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Ссылка на пост"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-xs md:text-sm min-w-0"
              />
              <button
                onClick={() => onSubmit(link)}
                className="bg-emerald-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                Отправить
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-2 text-xs md:text-sm text-emerald-400">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <a href={task.published_link || '#'} target="_blank" rel="noreferrer" className="underline truncate">
              Посмотреть публикацию
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active
          ? "bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20"
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn("transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")}>
        {icon}
      </span>
      <span className="text-sm tracking-wide">{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-black rounded-full" />}
    </button>
  );
}

function PublicationsTab({ publications }: { publications: Publication[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Публикации</h2>
          <p className="text-white/40 text-sm">Отслеживание отправленных видео и ссылок от пользователей</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {publications.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <ExternalLink className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 font-medium">Пока нет зафиксированных публикаций</p>
          </div>
        )}
        {publications.map((pub) => (
          <div key={pub.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-6 hover:border-emerald-500/30 transition-all group">
            <div className="w-full md:w-32 aspect-[9/16] rounded-xl overflow-hidden bg-black shrink-0 relative">
              <img src={pub.clip_thumbnail} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500" alt="" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-lg mb-1 line-clamp-1">{pub.clip_title}</h4>
                  <div className="flex items-center gap-2 text-sm text-white/40">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px] font-bold text-emerald-500 border border-emerald-500/20">
                      {pub.first_name?.[0] || 'U'}
                    </div>
                    <span className="font-medium text-white/70">{pub.first_name}</span>
                    <span className="opacity-50">@{pub.username}</span>
                    <span>•</span>
                    <span>{format(new Date(pub.created_at), 'dd.MM, HH:mm')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {pub.status === 'published' ? (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase">Опубликовано</span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full font-bold uppercase">Отправлено</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {pub.social_links.map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noreferrer" className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-emerald-400 hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Ссылка {i + 1}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function SettingsTab({ currentUser, authToken, onUpdate, plaques, onAddPlaque, onDeletePlaque }: {
  currentUser: User,
  authToken: string,
  onUpdate: () => void,
  plaques: AdPlaque[],
  onAddPlaque: (e: React.FormEvent<HTMLFormElement>) => Promise<void>,
  onDeletePlaque: (id: string) => Promise<void>
}) {
  const [watermarkText, setWatermarkText] = useState(currentUser.watermark_text !== null && currentUser.watermark_text !== undefined ? currentUser.watermark_text : `@${currentUser.username || currentUser.first_name}`);
  const [watermarkOpacity, setWatermarkOpacity] = useState(currentUser.watermark_opacity !== undefined && currentUser.watermark_opacity !== null ? Number(currentUser.watermark_opacity) : 0.08);
  const [watermarkPosition, setWatermarkPosition] = useState(currentUser.watermark_position || 'center');

  const [subtitleEnabled, setSubtitleEnabled] = useState(currentUser.subtitle_enabled !== false);
  const [subtitleFontSize, setSubtitleFontSize] = useState(currentUser.subtitle_font_size || 48);
  const [subtitleFontColor, setSubtitleFontColor] = useState(currentUser.subtitle_font_color || '#FFFFFF');
  const getInitialPosition = (val: any) => {
    if (val === 'Bottom') return '80';
    if (val === 'Center') return '50';
    if (val === 'Top') return '15';
    const num = Number(val);
    return isNaN(num) ? '80' : num.toString();
  };

  const [subtitlePosition, setSubtitlePosition] = useState(getInitialPosition(currentUser.subtitle_position));
  const [subtitleStyle, setSubtitleStyle] = useState(currentUser.subtitle_style || 'karaoke');
  const [subtitleFontFamily, setSubtitleFontFamily] = useState(currentUser.subtitle_font_family || 'Anton');
  const [subtitleHighlightColor, setSubtitleHighlightColor] = useState(currentUser.subtitle_highlight_color || '#FFFF00');
  const [subtitleHighlightEnabled, setSubtitleHighlightEnabled] = useState(currentUser.subtitle_highlight_enabled !== false);
  const [subtitleOutlineColor, setSubtitleOutlineColor] = useState(currentUser.subtitle_outline_color || '#000000');

  const [defaultPlaqueId, setDefaultPlaqueId] = useState<string | null>(currentUser.default_plaque_id || null);
  const [plaquePosition, setPlaquePosition] = useState(currentUser.plaque_position || 'bottom');
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setWatermarkText(currentUser.watermark_text !== null && currentUser.watermark_text !== undefined ? currentUser.watermark_text : `@${currentUser.username || currentUser.first_name}`);
      setWatermarkOpacity(currentUser.watermark_opacity !== undefined && currentUser.watermark_opacity !== null ? Number(currentUser.watermark_opacity) : 0.08);
      setWatermarkPosition(currentUser.watermark_position || 'center');
      setSubtitleEnabled(currentUser.subtitle_enabled !== false);
      setSubtitleFontSize(currentUser.subtitle_font_size ? Number(currentUser.subtitle_font_size) : 48);
      setSubtitleFontColor(currentUser.subtitle_font_color || '#FFFFFF');
      setSubtitlePosition(getInitialPosition(currentUser.subtitle_position));
      setSubtitleStyle(currentUser.subtitle_style || 'karaoke');
      setSubtitleFontFamily(currentUser.subtitle_font_family || 'Anton');
      setSubtitleHighlightColor(currentUser.subtitle_highlight_color || '#FFFF00');
      setSubtitleHighlightEnabled(currentUser.subtitle_highlight_enabled !== false);
      setSubtitleOutlineColor(currentUser.subtitle_outline_color || '#000000');
      setDefaultPlaqueId(currentUser.default_plaque_id || null);
      setPlaquePosition(currentUser.plaque_position || 'bottom');
    }
  }, [currentUser]);

  const SUBTITLE_STYLES = [
    { id: '1_word', name: '1 Слово', description: 'По одному слову на экране.' },
    { id: 'karaoke', name: 'Караоке', description: 'По 3 слова с подсветкой активного слова.' },
    { id: '3_words', name: '3 Слова', description: 'По 3 слова на экране статично.' },
  ];

  const FONT_FAMILIES = [
    { id: 'Anton', name: 'Anton', googleUrl: 'Anton' },
    { id: 'Montserrat', name: 'Montserrat', googleUrl: 'Montserrat:wght@900' },
    { id: 'Roboto', name: 'Roboto Black', googleUrl: 'Roboto:wght@900' },
    { id: 'Oswald', name: 'Oswald', googleUrl: 'Oswald:wght@700' }
  ];

  const [saving, setSaving] = useState(false);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          watermark_text: watermarkText,
          watermark_opacity: watermarkOpacity,
          watermark_position: watermarkPosition,
          subtitle_enabled: subtitleEnabled,
          subtitle_font_size: subtitleFontSize,
          subtitle_font_color: subtitleFontColor,
          subtitle_position: subtitlePosition,
          subtitle_style: subtitleStyle,
          subtitle_font_family: subtitleFontFamily,
          subtitle_highlight_color: subtitleHighlightColor,
          subtitle_highlight_enabled: subtitleHighlightEnabled,
          subtitle_outline_color: subtitleOutlineColor,
          default_plaque_id: defaultPlaqueId,
          plaque_position: plaquePosition
        })
      });
      if (res.ok) {
        alert('Настройки сохранены!');
        onUpdate();
      } else {
        alert('Ошибка при сохранении.');
      }
    } catch (e) {
      alert('Ошибка при сохранении.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Subtitles Section */}
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Layers className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold uppercase tracking-[0.2em] text-emerald-400">Субтитры</h3>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white/60 uppercase tracking-widest">Включить субтитры</span>
              <button
                onClick={() => setSubtitleEnabled(!subtitleEnabled)}
                className={`w-14 h-7 rounded-full transition-all relative ${subtitleEnabled ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${subtitleEnabled ? 'translate-x-7' : ''}`} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em]">Стиль отображения</label>
                <div className="grid grid-cols-3 gap-2">
                  {SUBTITLE_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSubtitleStyle(style.id)}
                      className={`text-[10px] uppercase font-black py-4 px-1 rounded-2xl transition-all border ${subtitleStyle === style.id ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={subtitleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em]">Шрифт</label>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_FAMILIES.map(font => (
                    <button
                      key={font.id}
                      onClick={() => setSubtitleFontFamily(font.id)}
                      className={`text-center py-3 px-3 rounded-xl text-xs font-bold transition-all border ${subtitleFontFamily === font.id ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-black/30 border-white/5 text-white/50 hover:bg-white/5 hover:border-white/20'}`}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={subtitleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em] flex justify-between">
                  <span>Размер шрифта</span>
                  <span className="text-emerald-400 font-mono">{subtitleFontSize}px</span>
                </label>
                <input
                  type="range"
                  min="10" max="32" step="1"
                  value={subtitleFontSize}
                  onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={subtitleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                  <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em]">Цвет текста</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={subtitleFontColor}
                      onChange={(e) => setSubtitleFontColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border-0 bg-transparent cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={subtitleFontColor}
                      onChange={(e) => setSubtitleFontColor(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className={subtitleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                  <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em]">Цвет обводки</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={subtitleOutlineColor}
                      onChange={(e) => setSubtitleOutlineColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border-0 bg-transparent cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={subtitleOutlineColor}
                      onChange={(e) => setSubtitleOutlineColor(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className={subtitleEnabled && (subtitleStyle === 'karaoke') ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Выделение активного слова</label>
                  <button onClick={() => setSubtitleHighlightEnabled(!subtitleHighlightEnabled)} className={`w-10 h-5 rounded-full transition-all relative ${subtitleHighlightEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${subtitleHighlightEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                <div className={`flex gap-2 transition-opacity ${subtitleHighlightEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <input
                    type="color"
                    value={subtitleHighlightColor}
                    onChange={(e) => setSubtitleHighlightColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border-0 bg-transparent cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={subtitleHighlightColor}
                    onChange={(e) => setSubtitleHighlightColor(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className={subtitleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em] flex justify-between">
                  <span>Положение (Вертикаль)</span>
                  <span className="text-emerald-400 font-mono">{subtitlePosition}%</span>
                </label>
                <input
                  type="range"
                  min="0" max="100" step="1"
                  value={subtitlePosition}
                  onChange={(e) => setSubtitlePosition(e.target.value)}
                  className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer mt-2 accent-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Ad Plaque Section */}
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <ImageIcon className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold uppercase tracking-[0.2em] text-emerald-400">Рекламная плашка</h3>
            </div>

            <div className="space-y-6">
              <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em]">Выбрать основную</label>

              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <button
                  onClick={() => setDefaultPlaqueId(null)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${defaultPlaqueId === null ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 font-bold'}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center border border-white/10">
                    <XCircle className="w-6 h-6 opacity-40" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-[10px] uppercase tracking-[0.1em]">Без плашки</p>
                    <p className="text-[10px] opacity-60">Только видео без оверлеев</p>
                  </div>
                </button>

                {plaques.map(plaque => (
                  <div key={plaque.id} className="relative group">
                    <button
                      onClick={() => setDefaultPlaqueId(plaque.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${defaultPlaqueId === plaque.id ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 font-bold'}`}
                    >
                      <img src={plaque.image_url} className="w-12 h-12 rounded-xl object-cover bg-black border border-white/10" alt="" />
                      <div className="text-left min-w-0 flex-1">
                        <p className="font-black text-[10px] uppercase tracking-[0.1em] truncate">{plaque.name}</p>
                        <p className="text-[10px] opacity-60 truncate">{plaque.text}</p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeletePlaque(plaque.id); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg group-hover:opacity-100 opacity-0 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Добавить в коллекцию</p>
                <form onSubmit={async (e) => {
                  setUploadLoading(true);
                  await onAddPlaque(e);
                  setUploadLoading(false);
                }} className="space-y-3">
                  <input name="name" required placeholder="Название (для списка)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500 placeholder:text-white/20" />
                  <div className="relative group/file">
                    <input type="file" name="file" accept="image/*" required className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/40 group-hover/file:border-white/20 transition-all flex items-center justify-between">
                      <span>Выбрать файл изображения</span>
                      <Plus className="w-4 h-4" />
                    </div>
                  </div>
                  <input name="text" required placeholder="Текст на плашке (CTA)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500 placeholder:text-white/20" />
                  <button
                    type="submit"
                    disabled={uploadLoading}
                    className="w-full bg-emerald-500 font-black text-[10px] uppercase tracking-[0.2em] text-black py-4 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {uploadLoading ? "ЗАГРУЗКА..." : "ЗАГРУЗИТЬ И ДОБАВИТЬ"}
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Расположение на видео</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'top', label: 'Сверху' },
                    { id: 'center', label: 'Центр' },
                    { id: 'bottom', label: 'Снизу' }
                  ].map(pos => (
                    <button
                      key={pos.id}
                      onClick={() => setPlaquePosition(pos.id)}
                      className={`text-[10px] uppercase font-black py-4 rounded-xl border transition-all ${plaquePosition === pos.id ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 font-black' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Watermark Section */}
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Zap className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold uppercase tracking-[0.2em] text-emerald-400">Водяной знак</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em]">Текст знака</label>
                <input
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em] flex justify-between">
                    <span>Прозрачность</span>
                    <span className="text-emerald-400 font-mono">{Math.round(watermarkOpacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.01" max="0.5" step="0.01"
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/40 mb-3 uppercase tracking-[0.2em]">Позиция</label>
                  <select
                    value={watermarkPosition}
                    onChange={(e) => setWatermarkPosition(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-[10px] font-black uppercase text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="center">По центру</option>
                    <option value="top_left">Слева сверху</option>
                    <option value="top_right">Справа сверху</option>
                    <option value="bottom_left">Слева снизу</option>
                    <option value="bottom_right">Справа снизу</option>
                    <option value="tilted_center">Наклон (Центр)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.3em] text-xs hover:bg-emerald-400 transition-all shadow-[0_15px_40px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-3 group"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 transition-transform group-hover:scale-110" />}
            {saving ? 'СОХРАНЕНИЕ...' : 'ПРИМЕНИТЬ ДЛЯ ВСЕХ ВИДЕО'}
          </button>
        </div>

        <div className="space-y-8">
          <div className="sticky top-24 space-y-6">
            <div className="flex flex-col items-center">
              <style>
                {`@import url('https://fonts.googleapis.com/css2?family=${FONT_FAMILIES.find(f => f.id === subtitleFontFamily)?.googleUrl || 'Anton'}&display=swap');`}
              </style>
              <div className="flex items-center gap-2 mb-4 self-start md:self-center">
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                <span className="block text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">ФИНАЛЬНЫЙ ПРЕДПРОСМОТР</span>
              </div>

              <div className="relative aspect-[9/16] bg-[#000] rounded-[3rem] overflow-hidden border-[6px] border-white/10 w-full max-w-[320px] shadow-[0_0_120px_rgba(0,0,0,0.8)]">
                <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80" alt="bg" className="w-full h-full object-cover opacity-50 scale-105 blur-[2px]" />

                {/* Plaque Preview */}
                {defaultPlaqueId && plaques.find(p => p.id === defaultPlaqueId) && (
                  <div className={cn(
                    "absolute left-0 right-0 z-20 flex justify-center px-6 transition-all duration-500",
                    plaquePosition === 'top' ? 'top-12' : plaquePosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-16'
                  )}>
                    <div className="relative w-full">
                      <img
                        src={plaques.find(p => p.id === defaultPlaqueId)?.image_url}
                        className="w-full h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)] rounded-xl"
                        alt=""
                      />
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <p className="text-[10px] font-black text-white text-center leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase tracking-wider">
                          {plaques.find(p => p.id === defaultPlaqueId)?.text}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtitles Preview */}
                <div
                  className="absolute left-0 right-0 flex justify-center px-4 z-10 transition-all duration-500"
                  style={{
                    top: `${subtitlePosition}%`,
                    transform: 'translateY(-50%)'
                  }}
                >
                  <div
                    className={`inline-block px-3 py-1 font-bold ${subtitleStyle === 'ali' ? 'bg-[#F0F0F0] text-[#808080]' : ''}`}
                    style={{
                      fontFamily: `"${subtitleFontFamily}", sans-serif`,
                      fontSize: `${Math.max(12, subtitleFontSize * 0.8)}px`,
                      borderRadius: '6px',
                      textShadow: subtitleStyle.includes('hormozi') ? `3px 3px 0 ${subtitleOutlineColor}, -1px -1px 0 ${subtitleOutlineColor}, 1px -1px 0 ${subtitleOutlineColor}, -1px 1px 0 ${subtitleOutlineColor}, 1px 1px 0 ${subtitleOutlineColor}, 0 6px 12px rgba(0,0,0,0.6)` :
                        subtitleStyle === 'beast' ? `1px 1px 0 ${subtitleFontColor}, -1px -1px 0 ${subtitleFontColor}, 1px -1px 0 ${subtitleFontColor}, -1px 1px 0 ${subtitleFontColor}, 1px 1px 0 ${subtitleFontColor}, 0px 0px 6px ${subtitleOutlineColor}` :
                          subtitleStyle === 'mrb' ? `4px 4px 0 ${subtitleOutlineColor}, -2px -2px 0 ${subtitleOutlineColor}, 4px -2px 0 ${subtitleOutlineColor}, -2px 4px 0 ${subtitleOutlineColor}, 0px 0px 8px ${subtitleOutlineColor}` :
                            subtitleStyle === 'devin' ? `2px 2px 0 ${subtitleOutlineColor}, -1px -1px 0 ${subtitleOutlineColor}, 2px -1px 0 ${subtitleOutlineColor}, -1px 2px 0 ${subtitleOutlineColor}` :
                              subtitleStyle === 'iman' ? `1px 1px 3px ${subtitleOutlineColor}` :
                                (subtitleStyle === 'celine' || subtitleStyle === 'karaoke') ? `1px 1px 4px ${subtitleOutlineColor}` : 'none',
                      color: subtitleStyle === 'ali' ? '#808080' : subtitleStyle === 'iman' ? 'rgba(255,255,255,0.7)' : '#FFFFFF',
                      textTransform: (subtitleStyle === 'beast' || subtitleStyle.includes('hormozi') || subtitleStyle === 'mrb') ? 'uppercase' : subtitleStyle === 'iman' ? 'lowercase' : 'none',
                      letterSpacing: subtitleStyle.includes('hormozi') ? '0.05em' : 'normal'
                    }}
                  >
                    {subtitleStyle === 'celine' ? (
                      <span className="tracking-[0.1em]">ОБЫЧНЫЕ СУБТИТРЫ</span>
                    ) : (
                      <>
                        <span style={{
                          transform: subtitleStyle === 'devin' ? 'scale(0.85)' : 'none',
                          display: 'inline-block'
                        }}>{subtitleStyle === 'iman' ? 'лучший ' : 'ЛУЧШИЙ '}</span>
                        <span
                          style={{
                            color: subtitleStyle === 'iman' ? '#FFFFFF' : (subtitleHighlightEnabled ? subtitleHighlightColor : subtitleFontColor),
                            display: 'inline-block',
                            transform: subtitleStyle === 'devin' ? 'scale(1.2) rotate(-4deg)' :
                              subtitleStyle === 'beast' ? 'scale(1.25)' :
                                subtitleStyle === 'mrb' ? 'scale(1.2) translateY(-3px)' :
                                  subtitleStyle === 'iman' ? 'scale(1.1)' :
                                    subtitleStyle === 'ali' || subtitleStyle.includes('hormozi') ? 'scale(1.2)' : 'none',
                            fontWeight: subtitleStyle === 'iman' ? '900' : 'bold',
                            margin: '0 8px',
                            textShadow: subtitleStyle.includes('hormozi') ? `3px 3px 0 ${subtitleOutlineColor}, -1px -1px 0 ${subtitleOutlineColor}, 1px -1px 0 ${subtitleOutlineColor}, -1px 1px 0 ${subtitleOutlineColor}, 1px 1px 0 ${subtitleOutlineColor}` :
                              subtitleStyle === 'iman' ? 'none' : 'auto'
                          }}
                        >{subtitleStyle === 'iman' ? 'результат' : 'РЕЗУЛЬТАТ'}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Watermark Preview */}
                <div
                  className={cn(
                    "absolute font-black text-white whitespace-nowrap tracking-[0.2em] transition-all duration-700",
                    watermarkPosition === 'top_left' ? 'top-8 left-8' :
                      watermarkPosition === 'top_right' ? 'top-8 right-8' :
                        watermarkPosition === 'bottom_left' ? 'bottom-12 left-8' :
                          watermarkPosition === 'bottom_right' ? 'bottom-12 right-8' :
                            'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                  )}
                  style={{
                    opacity: watermarkOpacity,
                    fontSize: watermarkPosition === 'tilted_center' ? '48px' : '12px',
                    transform: (watermarkPosition === 'center' || watermarkPosition === 'tilted_center')
                      ? `translate(-50%, -50%) ${watermarkPosition === 'tilted_center' ? 'rotate(-35deg)' : ''}`
                      : 'none'
                  }}
                >
                  {watermarkText}
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-emerald-500/20 flex items-center justify-center">
                      <Zap className="w-3 h-3 text-emerald-500" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Ready for Reels / TikTok</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

