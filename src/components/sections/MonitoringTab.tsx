import React, { useState } from 'react';
import { 
  Play, 
  Trash2, 
  Plus, 
  RefreshCw,
  Tv,
  Eye,
  EyeOff,
  Check,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
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
  onSyncChannel: (id: string) => Promise<boolean>;
  onAddChannel: (url: string, interval: string, scrapeDays: number) => void;
  onToggleChannelPublic?: (id: string, isPublic: boolean) => void;
  processingId: string | null;
  currentUserProfile?: any;
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
  onSyncChannel,
  onAddChannel,
  onToggleChannelPublic,
  processingId,
  currentUserProfile
}: MonitoringTabProps) {
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [monitoringInterval, setMonitoringInterval] = useState('daily');
  const [scrapeDays, setScrapeDays] = useState(7);
  const [addingChannel, setAddingChannel] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

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

  // Filter and sort videos
  const filteredVideos = videos
    .filter(v => !selectedChannelId || v.channel_id === selectedChannelId)
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  return (
    <div className="space-y-6">
      {/* Channels Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Tv className="w-5 h-5 text-blue-600" />
          YouTube каналы
        </h3>

        {/* Add Channel Form */}
        <div className="flex flex-col gap-3 mb-6">
          <input
            value={newChannelUrl}
            onChange={(e) => setNewChannelUrl(e.target.value)}
            placeholder="YouTube URL или ID канала"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-600 outline-none transition-all"
          />
          <div className="flex gap-3">
            <select
              value={monitoringInterval}
              onChange={(e) => setMonitoringInterval(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-600 text-sm flex-1"
            >
              <option value="daily">Каждый день</option>
              <option value="weekly">Каждую неделю</option>
              <option value="manual">Вручную</option>
            </select>
            <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden flex-1 focus-within:border-blue-600 items-center">
              <span className="pl-4 text-white/40 text-[10px] uppercase font-bold whitespace-nowrap">Видео за:</span>
              <input
                type="number"
                min="0"
                value={scrapeDays}
                onChange={(e) => setScrapeDays(parseInt(e.target.value) || 0)}
                className="w-full bg-transparent px-2 py-3 outline-none text-sm text-center font-bold"
                title="Сканировать видео за последние X дней (0 = все)"
                placeholder="0"
              />
              <span className="text-white/40 text-[10px] uppercase font-bold px-3 py-3 bg-white/5 border-l border-white/10 flex items-center whitespace-nowrap">дн.</span>
            </div>
            <button
              onClick={handleAddChannel}
              disabled={addingChannel || !newChannelUrl}
              className="px-6 py-3 bg-blue-600 text-black font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {addingChannel ? 'Загрузка...' : 'Добавить канал'}
            </button>
          </div>
        </div>

        {/* Channel List */}
        {channels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(channel => {
              const isSelected = selectedChannelId === channel.id;
              return (
                <div 
                  key={channel.id} 
                  onClick={() => setSelectedChannelId(isSelected ? null : channel.id)}
                  className={cn(
                    "relative bg-black/30 border rounded-xl p-4 flex items-center gap-3 group transition-all cursor-pointer",
                    isSelected 
                      ? "border-blue-600 bg-blue-600/10 shadow-[0_0_15px_rgba(37,99,235,0.15)] ring-1 ring-blue-600/50" 
                      : "border-white/5 hover:bg-white/5 hover:border-white/10"
                  )}
                >
                  {channel.thumbnail && (
                    <img src={channel.thumbnail} className="w-10 h-10 rounded-full border border-white/10 object-cover shrink-0" alt="" />
                  )}
                  <div className="flex-1 min-w-0 pr-16 text-left">
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
                  <div className="absolute bottom-2 right-2 flex flex-row gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {currentUserProfile?.is_admin && onToggleChannelPublic ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleChannelPublic(channel.id, !channel.is_public);
                        }}
                        className={`p-1.5 rounded-lg border transition-all ${
                          channel.is_public 
                            ? "bg-blue-600/20 text-blue-600 border-blue-600/20 hover:bg-blue-600/30" 
                            : "bg-white/5 text-white/20 border-white/10 hover:bg-white/10"
                        }`}
                        title={channel.is_public ? "Сделать приватным" : "Сделать публичным"}
                      >
                        {channel.is_public ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span 
                        className={`p-1.5 rounded-lg border ${
                          channel.is_public 
                            ? "bg-blue-600/20 text-blue-600 border-blue-600/20" 
                            : "bg-white/5 text-white/20 border-white/10"
                        }`}
                        title={channel.is_public ? "Публичный" : "Приватный"}
                      >
                        {channel.is_public ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </span>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (channel.sync_status === 'syncing') return;
                        setSyncingId(channel.id);
                        try {
                          await onSyncChannel(channel.id);
                          setSyncingId(channel.id + '-success');
                        } catch (err) {
                          setSyncingId(channel.id + '-error');
                        } finally {
                          setTimeout(() => setSyncingId(null), 3000);
                        }
                      }}
                      disabled={syncingId === channel.id || channel.sync_status === 'syncing'}
                      className={`p-1.5 rounded-lg border transition-all ${
                        syncingId === channel.id + '-success' || (channel.sync_status === 'idle' && (syncingId === null || syncingId === channel.id + '-success'))
                          ? "bg-green-600/20 text-green-500 border-green-600/20"
                          : syncingId === channel.id || channel.sync_status === 'syncing'
                            ? "bg-blue-600/20 text-blue-500 border-blue-600/20"
                            : syncingId === channel.id + '-error' || channel.sync_status === 'error'
                              ? "bg-red-600/20 text-red-500 border-red-600/20"
                              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                      }`}
                      title={
                        channel.sync_status === 'syncing' 
                          ? "Синхронизация..." 
                          : channel.sync_status === 'error' 
                            ? `Ошибка: ${channel.sync_error || 'Неизвестная ошибка'}` 
                            : "Синхронизировать сейчас"
                      }
                    >
                      {syncingId === channel.id + '-success' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : syncingId === channel.id || channel.sync_status === 'syncing' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : syncingId === channel.id + '-error' || channel.sync_status === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChannel(channel.id);
                      }}
                      className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Удалить канал"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!currentUserProfile?.is_admin && (
                     <div className="absolute top-2 right-2 group-hover:hidden transition-all">
                        <span className={`w-2 h-2 rounded-full block ${channel.is_public ? 'bg-blue-600' : 'bg-white/20'}`} />
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-white/20 text-sm text-center py-4">Каналов пока нет</p>
        )}
      </div>

      {/* Videos Section */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold">Мониторинг</h2>
          <div className="flex items-center gap-2">
            <p className="text-white/40 text-sm">
              {selectedChannelId ? (
                <>Фильтр по каналу: <span className="text-blue-500 font-bold">{channels.find(c => c.id === selectedChannelId)?.name}</span></>
              ) : (
                'Проверка новых роликов и AI анализ'
              )}
            </p>
            {selectedChannelId && (
              <button 
                onClick={() => setSelectedChannelId(null)}
                className="text-[10px] text-red-400/60 hover:text-red-400 underline uppercase tracking-tighter"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
        >
          <RefreshCw className={loadingVideos ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredVideos.map(video => (
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
              className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {filteredVideos.length === 0 && !loadingVideos && (
          <div className="py-20 text-center text-white/20 bg-white/5 rounded-2xl border border-white/5">
            <Play className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>{selectedChannelId ? "У этого канала пока нет видео." : "Новых видео для мониторинга пока нет."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
