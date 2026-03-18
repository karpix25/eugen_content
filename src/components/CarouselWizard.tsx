
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Layout, ImageIcon, Loader2, CheckCircle, AlertCircle, ChevronRight, Hash } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { cn } from '../lib/utils';

interface CarouselStyle {
  id: string;
  name: string;
  image_url: string;
  analysis: any;
}

interface CarouselWizardProps {
  clip: { id: string; title: string, transcript: string, hook?: string };
  authToken: string;
  targetAudience: string;
  onClose: () => void;
}

export default function CarouselWizard({ clip, authToken, targetAudience, onClose }: CarouselWizardProps) {
  const [step, setStep] = useState<'style' | 'progress' | 'success'>('style');
  const [topic, setTopic] = useState(clip.hook || clip.title);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [carouselId, setCarouselId] = useState<string | null>(null);

  // Styles Query
  const { data: styles = [], isLoading: loadingStyles } = useQuery({
    queryKey: ['carouselStyles'],
    queryFn: () => api.carousels.listStyles(),
  });

  // Polling Status Query
  const { data: carouselStatus } = useQuery({
    queryKey: ['carousel', carouselId],
    queryFn: () => api.carousels.get(carouselId!),
    enabled: !!carouselId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'ready' || status === 'error') ? false : 3000;
    }
  });

  // Watch for status change to transition to success step
  useEffect(() => {
    if (carouselStatus?.status === 'ready') {
      setStep('success');
    }
  }, [carouselStatus?.status]);

  useEffect(() => {
    if (styles.length > 0 && !selectedStyleId) {
      setSelectedStyleId(styles[0].id);
    }
  }, [styles, selectedStyleId]);

  const startGeneration = async () => {
    if (!selectedStyleId) return;
    setStep('progress');
    try {
      const data = await api.carousels.generate({ 
        clipId: clip.id, 
        styleId: selectedStyleId, 
        topic, 
        targetAudience 
      });
      if (data.carouselId) {
        setCarouselId(data.carouselId);
      }
    } catch (err) {
      console.error("Failed to start generation", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111] border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-blue-600/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Layout className="w-6 h-6 text-black" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Carousel Genius</h3>
              <p className="text-white/40 text-sm">Создаем виральную карусель из вашего видео</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 'style' && (
              <motion.div 
                key="style"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> Визуальный стиль
                  </label>
                  <p className="text-sm text-white/60">Выберите стиль оформления для ваших карточек.</p>
                  
                  {loadingStyles ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">Загрузка стилей...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {styles.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStyleId(s.id)}
                          className={cn(
                            "relative aspect-[4/5] rounded-3xl overflow-hidden border-2 transition-all group",
                            selectedStyleId === s.id ? "border-blue-600 ring-4 ring-blue-600/20" : "border-white/5 hover:border-white/20"
                          )}
                        >
                          <img src={s.image_url} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="font-bold text-sm truncate">{s.name}</p>
                          </div>
                          {selectedStyleId === s.id && (
                            <div className="absolute top-4 right-4 bg-blue-600 text-black p-1 rounded-full">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={onClose}
                    className="flex-1 h-16 bg-white/5 text-white rounded-2xl font-bold hover:bg-white/10 transition-all border border-white/5"
                  >
                    Отмена
                  </button>
                  <button 
                    onClick={startGeneration}
                    disabled={!selectedStyleId}
                    className="flex-[2] h-16 bg-blue-600 text-black rounded-2xl font-bold text-lg hover:bg-blue-500 disabled:opacity-50 transition-all"
                  >
                    Генерировать ✨
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'progress' && (
              <motion.div 
                key="progress"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 gap-8"
              >
                <div className="relative">
                  <div className="w-32 h-32 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-blue-600 animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-4">
                  <h4 className="text-2xl font-black italic uppercase tracking-tighter">Магия в процессе...</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-white/40 flex items-center justify-center gap-2">
                      <Hash className="w-4 h-4 text-blue-600" /> ИИ пишет виральный текст
                    </p>
                    <p className="text-sm text-white/40 flex items-center justify-center gap-2">
                      <Hash className="w-4 h-4 text-blue-600" /> Рисуем визуальный фон
                    </p>
                    <p className="text-sm text-white/40 flex items-center justify-center gap-2">
                      <Hash className="w-4 h-4 text-blue-600" /> Нарезаем для Instagram
                    </p>
                  </div>
                  <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.3em] pt-4">Это может занять до 1-2 минут</p>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 gap-8"
              >
                <div className="w-32 h-32 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)]">
                  <CheckCircle className="w-16 h-16 text-black" />
                </div>
                <div className="text-center space-y-2 mb-4">
                  <h4 className="text-3xl font-black uppercase italic tracking-tighter">Готово!</h4>
                  <p className="text-white/60">Ваша карусель сгенерирована и скоро придет в Telegram.</p>
                </div>

                <button 
                  onClick={onClose}
                  className="w-full h-16 bg-white text-black rounded-2xl font-bold text-lg hover:bg-blue-600 transition-all shadow-xl"
                >
                  Шикарно!
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
