import React, { useState, useEffect } from 'react';

export function AdminStatsView({ authToken }: { authToken: string }) {
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    .then(r => r.json())
    .then(data => setStats(data))
    .catch(console.error);
  }, [authToken]);

  if (!stats) return null;

  return (
    <div className="mb-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-white/40 text-sm mb-2">Пользователей с публикациями</p>
          <p className="text-3xl font-bold text-emerald-400">{stats.reporting_users}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-white/40 text-sm mb-2">Опубликованных роликов</p>
          <p className="text-3xl font-bold text-emerald-400">{stats.total_published_videos}</p>
        </div>
      </div>
      
      {stats.top_clips && stats.top_clips.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">Самые популярные ролики</h3>
          <div className="space-y-4">
            {stats.top_clips.map((clip: any, i: number) => (
              <div key={clip.id} className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                <span className="text-white/40 font-bold w-6">{i + 1}.</span>
                <img src={clip.thumbnail} className="w-12 h-12 rounded bg-black object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{clip.title}</p>
                  <p className="text-emerald-400 text-xs mt-1">{clip.publish_count} публикаций</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
