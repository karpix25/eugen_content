import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, RefreshCw, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { VideoData } from '../../types';
import { cn } from '../../lib/utils';

interface VideoCardProps {
  video: VideoData;
  onEvaluate: () => void;
  onApprove: (targetLanguage?: string) => void;
  onDelete: () => void;
  loading: boolean;
}

export function VideoCard({ video, onEvaluate, onApprove, onDelete, loading }: VideoCardProps) {
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
        className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col sm:flex-row min-w-0 sm:min-h-[220px]"
      >
        <div className="relative w-full sm:w-64 md:w-72 aspect-square shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-hidden bg-black">
          {/* Blurred background */}
          <img 
            src={video.thumbnail} 
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-110" 
            alt="" 
          />
          {/* Main contained image */}
          <img 
            src={video.thumbnail} 
            className="relative z-10 w-full h-full object-contain" 
            alt="" 
          />
          <div className="absolute inset-0 z-20 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-[2px]">
            <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="p-3 bg-white/20 backdrop-blur-md rounded-full">
              <ExternalLink className="w-6 h-6" />
            </a>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col">
          <div className="flex justify-between items-start gap-4 mb-2">
            <h3 className="font-semibold text-lg leading-tight min-w-0">{video.title}</h3>
            {video.ai_score !== null && (
              <div className={cn(
                "w-[100px] h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold whitespace-nowrap",
                video.ai_score > 70 ? "bg-blue-600/20 text-blue-500" : "bg-yellow-500/20 text-yellow-400"
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
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <div className="text-xs text-white/40 mb-1 uppercase tracking-widest font-bold">Оценка ИИ:</div>
                <div className="text-sm text-white/80 bg-black/20 p-3 rounded-lg overflow-y-auto max-h-[120px] scrollbar-thin scrollbar-thumb-white/10">
                  <Markdown>{video.ai_evaluation}</Markdown>
                </div>
              </div>
            )}

            {video.ai_evaluation && video.status === 'pending' && (
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setShowDubModal(true)}
                  disabled={loading}
                  className={cn(
                    "p-2 bg-blue-600 text-black rounded-lg hover:bg-blue-500 transition-colors",
                    loading && "opacity-50 cursor-not-allowed"
                  )}
                  title="Одобрить и выбрать язык"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button 
                  onClick={onDelete}
                  title="Удалить видео"
                  className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            )}

            {(video.status === 'approved' || video.status === 'sent_to_vizard') && (
              <div className="ml-auto flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-blue-500 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {video.status === 'approved' ? 'Одобрено, отправка...' : 'В обработке (Vizard)...'}
                </div>
                {video.target_language && (
                  <div className="text-[10px] uppercase font-bold text-blue-600/60 tracking-wider">
                    Дубляж: {video.target_language === 'ru' ? 'RU' : 'EN'}
                  </div>
                )}
              </div>
            )}

            {video.status === 'completed' && (
              <div className="ml-auto flex flex-col items-end gap-1">
                <div className="text-blue-500 text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Готово
                </div>
              </div>
            )}

            {video.status === 'rejected' && (
              <div className="ml-auto flex flex-col items-end gap-1">
                <div className="text-red-500 text-sm font-medium flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Отклонено
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
                <p className="text-sm text-white/40">Определен язык оригинала: <strong className="text-blue-500 uppercase">{video.detected_language || 'Неизвестен'}</strong></p>
              </div>

              <div className="space-y-2 pt-2">
                {getDubbingOptions().map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setShowDubModal(false);
                      onApprove(opt.value);
                    }}
                    className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-600/50 transition-all font-medium text-sm flex items-center justify-between group"
                  >
                    {opt.label}
                    <CheckCircle className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
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
