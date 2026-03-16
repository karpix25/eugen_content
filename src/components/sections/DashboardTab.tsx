import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Video, 
  CheckCircle2, 
  TrendingUp, 
  Calendar,
  UserCheck,
  Trophy,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatsData {
  total: {
    channels: number;
    videos: number;
    clips: number;
    publications: number;
    users: number;
    authorized_users: number;
  };
  reporting_users: number;
  total_published_videos: number;
  recent: {
    today: number;
    week: number;
  };
  top_users: Array<{
    first_name: string;
    username: string;
    count: number;
  }>;
  top_clips: Array<{
    id: string;
    title: string;
    thumbnail: string;
    url: string;
    publish_count: number;
  }>;
  daily_trend: Array<{
    date: string;
    count: number;
  }>;
}

export function DashboardTab({ authToken }: { authToken: string }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [authToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats) return null;
  const mainMetrics = [
    { label: 'Всего пользователей', value: stats.total.users, subValue: `${stats.total.authorized_users} активных`, icon: <Users className="w-5 h-5 text-blue-400" />, color: 'blue' },
    { label: 'Опубликовано видео', value: stats.total_published_videos, subValue: `${stats.recent.today} за сегодня`, icon: <CheckCircle2 className="w-5 h-5 text-blue-600" />, color: 'blue' },
    { label: 'Всего назок', value: stats.total.clips, subValue: `из ${stats.total.videos} видео`, icon: <Video className="w-5 h-5 text-purple-400" />, color: 'purple' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black tracking-tight">Дашборд <span className="text-blue-600">Статистики</span></h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/40">
          <Calendar className="w-3 h-3" />
          Обновлено сегодня
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mainMetrics.map((m, i) => (
          <div key={i} className="group bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500",
                m.color === 'blue' && "bg-blue-500/10",
                m.color === 'blue' && "bg-blue-600/10",
                m.color === 'purple' && "bg-purple-500/10",
                m.color === 'orange' && "bg-orange-500/10"
              )}>
                {m.icon}
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/10 group-hover:text-white/40 transition-colors" />
            </div>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{m.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white tracking-tighter">{m.value}</span>
              <span className="text-xs font-bold text-white/20 truncate">{m.subValue}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Users */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold italic tracking-tight uppercase">Топ работников <span className="text-blue-600">.</span></h3>
          </div>
          <div className="space-y-3">
            {stats.top_users.map((user, i) => (
              <div key={i} className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 hover:border-blue-600/30 transition-all group">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-black text-blue-600 border border-blue-600/20">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{user.first_name}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">@{user.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-blue-500 tracking-tighter">{user.count}</p>
                  <p className="text-[9px] text-white/20 uppercase font-black">Сыллок</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Trend Chart (Simple CSS implementation) */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold italic tracking-tight uppercase">Тренд за 14 дней <span className="text-blue-500">.</span></h3>
          </div>
          
          <div className="h-48 flex items-end gap-2 px-2">
            {stats.daily_trend.map((day, i) => {
              const maxVal = Math.max(...stats.daily_trend.map(d => d.count), 1);
              const height = (day.count / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="relative w-full flex justify-center h-full items-end">
                    <div 
                      className="w-full max-w-[12px] bg-gradient-to-t from-blue-600/20 to-blue-500 rounded-t-full transition-all duration-1000 group-hover:opacity-80 relative"
                      style={{ height: `${height}%` }}
                    >
                      {day.count > 0 && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/40 bg-black/60 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {day.count}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">{day.date}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold italic tracking-tight uppercase">Популярные нарезки <span className="text-blue-600">.</span></h3>
        </div>
        <div className="space-y-3">
          {stats.top_clips.slice(0, 5).map((clip, i) => (
            <div key={clip.id} className="flex items-center gap-6 bg-black/40 p-4 rounded-3xl border border-white/5 hover:border-blue-600/30 transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[40px] rounded-full -mr-16 -mt-16 pointer-events-none" />
              
              <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-sm font-black text-blue-600 border border-blue-600/20 shrink-0">
                {i + 1}
              </div>

              <div className="relative w-32 h-20 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-2xl bg-black">
                {clip.thumbnail ? (
                  <img src={clip.thumbnail} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" alt="" />
                ) : clip.url ? (
                  <video src={clip.url + '#t=0.1'} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white/10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-lg tracking-tight truncate group-hover:text-blue-400 transition-colors">{clip.title}</p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/10 border border-blue-600/20 rounded-full">
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{clip.publish_count} повторов</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/10" />
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">ID: {clip.id.slice(0, 8)}</p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-blue-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
