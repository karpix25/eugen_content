import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, XCircle, Loader2, Send, Layout, CheckCircle, X } from 'lucide-react';
import { Clip, AdPlaque } from '../../types';
import { cn } from '../../lib/utils';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

interface ClipCardProps {
  clip: Clip;
  plaques: AdPlaque[];
  onSendToTelegram?: (clipId: string, plaqueId: string | null) => void;
  onSendCarousel?: (clipId: string) => void;
  currentUserProfile?: any;
}

export function ClipCard({ clip, plaques, onSendToTelegram, onSendCarousel, currentUserProfile }: ClipCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlaqueSelector, setShowPlaqueSelector] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingCarousel, setIsSendingCarousel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const entry = useIntersectionObserver(containerRef, {
    threshold: 0.1,
    freezeOnceVisible: true,
  });
  const isVisible = !!entry?.isIntersecting;

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

  const handleSendCarousel = async () => {
    if (!onSendCarousel) return;
    setIsSendingCarousel(true);
    try {
      await onSendCarousel(clip.id);
    } finally {
      setIsSendingCarousel(false);
    }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300"
      >
        <div className="aspect-[9/16] bg-black relative overflow-hidden">
          {!isPlaying ? (
            <>
              {isVisible && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="w-full h-full"
                >
                  {clip.thumbnail ? (
                    <img 
                      src={clip.thumbnail} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      alt="" 
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={clip.url + '#t=0.1'}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )}
                </motion.div>
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
            <div className="w-full h-full relative bg-black flex items-center justify-center">
              <video
                src={clip.url}
                className="w-full h-full object-contain"
                controls
                autoPlay
                playsInline
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
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

          <AnimatePresence>
            {/* Ad Plaque Simulation logic remains if plaque is selected? 
               Wait, App.tsx has randomPlaque state. In ClipCard it seems it was also used.
            */}
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
          {isSendingCarousel && (
            <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="w-10 h-10 text-[#229ED9] mb-3 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#229ED9]">Создание карусели...</p>
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

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowPlaqueSelector(true)}
              disabled={!clip.is_available || isSending || isSendingCarousel || !onSendToTelegram}
              className="flex-1 text-[11px] uppercase tracking-widest font-black py-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all shadow-[0_4px_20px_rgba(16,185,129,0.2)] disabled:opacity-30 flex items-center justify-center gap-2"
            >
              <Send className="w-3 h-3" /> {clip.published_by_me ? 'ВИДЕО ЕЩЕ РАЗ' : 'ВИДЕО'}
            </button>
            <button
              onClick={handleSendCarousel}
              disabled={!clip.is_available || isSending || isSendingCarousel || !onSendCarousel}
              className="flex-1 text-[11px] uppercase tracking-widest font-black py-3 bg-[#229ED9] text-white rounded-xl hover:bg-[#1f8ebf] transition-all shadow-[0_4px_20px_rgba(34,158,217,0.2)] disabled:opacity-30 flex items-center justify-center gap-2"
            >
              <Layout className="w-3 h-3" /> КАРУСЕЛЬ
            </button>
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
