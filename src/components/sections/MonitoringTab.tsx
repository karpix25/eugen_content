import React, { useState } from 'react';
import { 
  Play, 
  Trash2, 
  Plus, 
  RefreshCw,
  Tv
} from 'lucide-react';
import { VideoData, Channel } from '../../types';
import { VideoCard } from '../videos/VideoCard';

interface MonitoringTabProps {
  videos: VideoData[];
  channels: Channel[];
  loadingVideos: boolean;
  onEvaluate: (id: string) => void;
  onApprove: (id: string, targetLanguage?: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteChannel: (id: string) => void;
  onRefresh: () => void;
  onAddChannel: (url: string, interval: string, scrapeDays: number) => void;
  processingId: string | null;
}

function formatNumber(n: number | string | undefined): string {
  if (!n) return '';
  const num = typeof n === 'string' ? parseInt(n) : n;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

export function MonitoringTab({
  videos,
  channels,
  loadingVideos,
  onEvaluate,
  onApprove,
  onComplete,
  onDelete,
  onDeleteChannel,
  onRefresh,
  onAddChannel,
  processingId
}: MonitoringTabProps) {
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [monitoringInterval, setMonitoringInterval] = useState('daily');
  const [scrapeDays, setScrapeDays] = useState(7);
  const [addingChannel, setAddingChannel] = useState(false);

  const handleAddChannel = async () => {
    if (!newChannelUrl) return;
    setAddingChannel(true);
    try {
      await onAddChannel(newChannelUrl, monitoringInterval, scrapeDays);
      setNewChannelUrl('');
    } finally {
      setAddingChannel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Channels Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Tv className="w-5 h-5 text-emerald-500" />
          YouTube каналы
        </h3>

        {/* Add Channel Form */}
        <div className="flex flex-col gap-3 mb-6">
          <input
            value={newChannelUrl}
            onChange={(e) => setNewChannelUrl(e.target.value)}
            placeholder="YouTube URL или ID канала"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all"
          />
          <div className="flex gap-3">
            <select
              value={monitoringInterval}
              onChange={(e) => setMonitoringInterval(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm flex-1"
            >
              <option value="daily">Каждый день</option>
              <option value="weekly">Каждую неделю</option>
              <option value="manual">Вручную</option>
            </select>
            <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden flex-1 focus-within:border-emerald-500">
              <input
                type="number"
                min="0"
                value={scrapeDays}
                onChange={(e) => setScrapeDays(parseInt(e.target.value) || 0)}
                className="w-full bg-transparent px-4 py-3 outline-none text-sm"
                title="Дней назад (0 = все)"
                placeholder="Дней"
              />
              <span className="text-white/40 text-xs px-3 py-3 bg-white/5 border-l border-white/10 flex items-center whitespace-nowrap">дн.</span>
            </div>
            <button
              onClick={handleAddChannel}
              disabled={addingChannel || !newChannelUrl}
              className="px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {addingChannel ? 'Загрузка...' : 'Добавить канал'}
            </button>
          </div>
        </div>

        {/* Channel List */}
        {channels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(channel => (
              <div key={channel.id} className="relative bg-black/30 border border-white/5 rounded-xl p-4 flex items-center gap-3 group hover:bg-white/5 transition-colors">
                {channel.thumbnail && (
                  <img src={channel.thumbnail} className="w-10 h-10 rounded-full border border-white/10 object-cover shrink-0" alt="" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-medium truncate">{channel.name || channel.id}</h4>
                    {channel.subscribers !== undefined && (
                      <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                        {formatNumber(channel.subscribers)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-white/40">
                      {channel.monitoring_interval === 'daily' ? 'Ежедневно' : channel.monitoring_interval === 'weekly' ? 'Еженедельно' : 'Вручную'}
                    </span>
                    {channel.scrape_days !== undefined && (
                      <span className="text-[10px] text-white/30">{channel.scrape_days} дн.</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteChannel(channel.id)}
                  className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/20 text-sm text-center py-4">Каналов пока нет</p>
        )}
      </div>

      {/* Videos Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Мониторинг</h2>
          <p className="text-white/40 text-sm">Проверка новых роликов и AI анализ</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
        >
          <RefreshCw className={loadingVideos ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {videos.map(video => (
          <div key={video.id} className="relative group">
            <VideoCard
              video={video}
              onEvaluate={() => onEvaluate(video.id)}
              onApprove={(lang) => onApprove(video.id, lang)}
              onComplete={() => onComplete(video.id)}
              loading={processingId === video.id}
            />
            <button
              onClick={() => onDelete(video.id)}
              className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {videos.length === 0 && !loadingVideos && (
          <div className="py-20 text-center text-white/20">
            <Play className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Новых видео для мониторинга пока нет.</p>
          </div>
        )}
      </div>
    </div>
  );
}
