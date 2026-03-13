import React from 'react';
import { 
  Play, 
  Trash2, 
  ExternalLink, 
  CheckCircle, 
  Plus, 
  RefreshCw 
} from 'lucide-react';
import { VideoData } from '../../types';
import { VideoCard } from '../videos/VideoCard';

interface MonitoringTabProps {
  videos: VideoData[];
  loadingVideos: boolean;
  onEvaluate: (id: string) => void;
  onApprove: (id: string, targetLanguage?: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onAddManual: (e: React.FormEvent<HTMLFormElement>) => void;
  manualYoutubeUrl: string;
  setManualYoutubeUrl: (val: string) => void;
  processingId: string | null;
}

export function MonitoringTab({
  videos,
  loadingVideos,
  onEvaluate,
  onApprove,
  onComplete,
  onDelete,
  onRefresh,
  onAddManual,
  manualYoutubeUrl,
  setManualYoutubeUrl,
  processingId
}: MonitoringTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-500" />
          Добавить вручную
        </h3>
        <form onSubmit={onAddManual} className="flex gap-3">
          <input
            type="text"
            placeholder="Ссылка на YouTube (Shorts или Видео)"
            value={manualYoutubeUrl}
            onChange={(e) => setManualYoutubeUrl(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={loadingVideos || !manualYoutubeUrl}
            className="px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            Добавить
          </button>
        </form>
      </div>

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
