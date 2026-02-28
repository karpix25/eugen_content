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
  Send,
  Download,
  Menu,
  X,
  Trash2,
  Users,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';

interface Channel {
  id: string;
  name: string;
  thumbnail: string;
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
  status: 'pending' | 'approved' | 'rejected' | 'sent_to_vizard' | 'completed';
}

interface Clip {
  id: string;
  video_id: string;
  url: string;
  thumbnail: string;
  title: string;
  status: string;
  ad_plaque_id: string | null;
  is_available: boolean;
  downloaded_by: string | null;
  downloaded_at: string | null;
  transcript: string;
}

interface User {
  telegram_id: string;
  username: string;
  first_name: string;
  is_authorized: boolean;
  created_at: string;
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
  clip_thumbnail: string;
  clip_title: string;
}

function AuthPage({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  useEffect(() => {
    // Standard Telegram widget doesn't play well with React re-renders, 
    // so we manually inject the script after fetching the config.
    const loadWidget = async () => {
      try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        const botUsername = config.bot_username || "YOUR_BOT_USERNAME";

        const script = document.createElement('script');
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute('data-telegram-login', botUsername);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;
        
        const container = document.getElementById('telegram-widget-container');
        if (container) {
          container.innerHTML = ''; // Clear previous
          container.appendChild(script);
        }
      } catch (err) {
        console.error("Failed to load bot config:", err);
      }
    };

    loadWidget();

    (window as any).onTelegramAuth = async (user: any) => {
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
        const data = await res.json();
        if (data.token) {
          onLogin(data.token, data.user);
        } else {
          alert('Ошибка записи: ' + data.error);
        }
      } catch (err) {
        console.error(err);
        alert('Ошибка при соединении с сервером');
      }
    };

    return () => {
      if (container) container.innerHTML = '';
      delete (window as any).onTelegramAuth;
    };
  }, [onLogin]);

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
          <div id="telegram-widget-container" className="flex justify-center relative z-10" />
          
          <button 
            onClick={() => onLogin('dev-token', { id: 'dev', first_name: 'Developer', username: 'dev' })}
            className="w-full mt-6 py-3 bg-white/10 border border-white/10 rounded-xl text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-black transition-all relative z-20"
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
  const [activeTab, setActiveTab] = useState<'monitor' | 'clips' | 'ads' | 'tasks' | 'workers'>('monitor');
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
  const [loading, setLoading] = useState(false);
  const [targetAudience, setTargetAudience] = useState('Предприниматели, интересующиеся ИИ и автоматизацией');
  
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (authToken) {
      fetchData();
    }
  }, [authToken]);

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('auth_token');
  };

  const fetchData = async () => {
    const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
    try {
      const [chRes, vidRes, clipRes, adRes, taskRes, userRes] = await Promise.all([
        fetch('/api/channels', { headers }),
        fetch('/api/videos', { headers }),
        fetch('/api/clips', { headers }),
        fetch('/api/ad-plaques', { headers }),
        fetch('/api/tasks', { headers }),
        fetch('/api/users', { headers })
      ]);
      
      const resData = await Promise.all([
        chRes.json(),
        vidRes.json(),
        clipRes.json(),
        adRes.json(),
        taskRes.json(),
        userRes.json()
      ]);

      if (resData.some(d => d.error === 'Unauthorized' || d === 401)) {
        handleLogout();
        return;
      }

      setChannels(resData[0]);
      setVideos(resData[1]);
      setClips(resData[2]);
      setPlaques(resData[3]);
      setTasks(resData[4]);
      setUsers(resData[5]);
    } catch (err) {
      console.error("Failed to fetch data", err);
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
      await fetch(`/api/videos/${id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAudience })
      });
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/videos/${id}/approve`, { method: 'POST' });
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
          <NavButton
            active={activeTab === 'monitor'}
            onClick={() => setActiveTab('monitor')}
            icon={<Youtube className="w-5 h-5" />}
            label="Мониторинг"
          />
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
                    <img src={channel.thumbnail} className="w-12 h-12 rounded-full border border-white/10" alt="" />
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium truncate">{channel.name}</h3>
                        <span className="text-[10px] uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-white/40">
                          {channel.monitoring_interval === 'daily' ? 'Ежедневно' : channel.monitoring_interval === 'weekly' ? 'Еженедельно' : 'Вручную'}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 truncate">{channel.id}</p>
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
                      onApprove={() => handleApprove(video.id)}
                      onComplete={() => handleCompleteVideo(video.id)}
                      loading={loading}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clips' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {clips.map(clip => (
                <ClipCard key={clip.id} clip={clip} plaques={plaques} onCreateTask={() => handleCreateTask(clip.id)} />
              ))}
              {clips.length === 0 && (
                <div className="col-span-full py-20 text-center text-white/20">
                  <Video className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Нарезок пока нет. Одобрите видео в мониторинге.</p>
                </div>
              )}
            </div>
          )}

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
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Статус</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(user => (
                      <tr key={user.telegram_id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-emerald-400">{user.first_name}</div>
                          <div className="text-xs text-white/40">@{user.username || 'n/a'}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-white/60">{user.telegram_id}</td>
                        <td className="px-6 py-4">
                          {user.is_authorized ? (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold uppercase">Авторизован</span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-bold uppercase">В ожидании</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleAuthorize(user.telegram_id, !user.is_authorized)}
                            className={cn(
                              "px-3 py-1 rounded text-xs font-bold transition-colors",
                              user.is_authorized ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-emerald-500 text-black hover:bg-emerald-400"
                            )}
                          >
                            {user.is_authorized ? "Деавторизовать" : "Авторизовать"}
                          </button>
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
        </div>
      </main>
    </div>
  );
}

function VideoCard({ video, onEvaluate, onApprove, onComplete, loading }: { 
  video: VideoData, 
  onEvaluate: () => void, 
  onApprove: () => void, 
  onComplete: () => void,
  loading: boolean 
}) {
  return (
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
            <div className="text-xs text-yellow-500/80 bg-yellow-500/10 px-3 py-1 rounded-full flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Анализ ИИ...
            </div>
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
                onClick={onApprove} 
                disabled={loading}
                className={cn(
                  "p-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                <CheckCircle className="w-5 h-5" />
              </button>
              <button className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          )}

          {video.status === 'approved' && (
            <div className="ml-auto flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              В обработке Vizard...
            </div>
          )}

          {video.status === 'completed' && (
            <div className="ml-auto text-emerald-400 text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Готово
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
function ClipCard({ clip, plaques, onCreateTask }: { clip: Clip, plaques: AdPlaque[], onCreateTask: () => void }) {
  const [randomPlaque, setRandomPlaque] = useState<AdPlaque | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const applyRandomPlaque = () => {
    if (plaques.length === 0) return;
    const r = plaques[Math.floor(Math.random() * plaques.length)];
    setRandomPlaque(r);
  };

  return (
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



        {!clip.is_available && (
          <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Уже скачано</p>
            <p className="text-sm font-medium text-emerald-400">{clip.downloaded_by || 'Кто-то'}</p>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <button className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl">
            <Play className="w-6 h-6 fill-current" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <h4 className="font-semibold text-sm mb-2 text-white line-clamp-2 leading-snug" title={clip.title}>
          {clip.title}
        </h4>
        
        {clip.transcript && (
          <div className="mb-4 bg-black/20 rounded-lg p-2 border border-white/5">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Transcript</p>
            <p className="text-[11px] text-white/60 leading-relaxed line-clamp-3 select-all">
              {clip.transcript}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => console.log('Video clicked for', clip.id)}
            disabled={!clip.is_available}
            className="flex-1 text-[10px] uppercase tracking-widest font-black py-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all shadow-[0_4px_20px_rgba(16,185,129,0.2)] disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Video className="w-3 h-3" /> Видео
          </button>
          <button
            onClick={() => console.log('Carousel clicked for', clip.id)}
            disabled={!clip.is_available}
            className="flex-1 text-[10px] uppercase tracking-widest font-black py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 border border-white/10 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Layers className="w-3 h-3" /> Карусель
          </button>
        </div>
      </div>
    </div>
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
