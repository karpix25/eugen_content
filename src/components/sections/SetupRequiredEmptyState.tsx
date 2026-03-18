import React from 'react';
import { Lock, ArrowRight, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface SetupRequiredEmptyStateProps {
  onGoToSettings: () => void;
  title?: string;
  description?: string;
}

export function SetupRequiredEmptyState({ 
  onGoToSettings, 
  title = "Требуется настройка профиля",
  description = "Чтобы мы могли генерировать видео в вашем стиле, пожалуйста, заполните данные в профиле (шрифты, водяной знак и брендинг)."
}: SetupRequiredEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 bg-blue-600/20 blur-[50px] rounded-full"></div>
        <div className="relative w-24 h-24 bg-[#111] border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
          <Lock className="w-10 h-10 text-blue-500" />
        </div>
        
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-4 border-[#0A0A0A]"
        >
          <Settings className="w-4 h-4 text-black" />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="max-w-md space-y-4"
      >
        <h2 className="text-3xl font-black italic uppercase tracking-tight text-white">
          {title}
        </h2>
        <p className="text-white/50 text-lg leading-relaxed">
          {description}
        </p>
        
        <div className="pt-6">
          <button
            onClick={onGoToSettings}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-black font-black uppercase italic tracking-wider rounded-2xl hover:bg-blue-500 transition-all active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.3)]"
          >
            Настроить сейчас
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
        {[
          { label: "Водяной знак", desc: "Ваш логотип или текст" },
          { label: "Стили текста", desc: "Шрифты и цвета" },
          { label: "Брендинг", desc: "Лицо вашего канала" }
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + (i * 0.1) }}
            className="p-4 rounded-2xl bg-white/5 border border-white/5 text-left"
          >
            <div className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">{item.label}</div>
            <div className="text-sm text-white/40">{item.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
