import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Type, 
  User as UserIcon, 
  ImageIcon, 
  Zap, 
  ArrowRight, 
  Check, 
  Sparkles,
  MousePointer2,
  ChevronLeft,
  Loader2,
  MessageSquare as MessageSquareIcon,
  Sparkles as SparklesIcon,
  Layers as LayersIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, AdPlaque } from '../types';
import { api } from '../services/api';

interface OnboardingWizardProps {
  currentUser: User;
  authToken: string;
  plaques: AdPlaque[];
  onComplete: () => void;
}

const STEPS = [
  { id: 'subtitles', title: 'Стиль текста', icon: <Type /> },
  { id: 'branding', title: 'Личный бренд', icon: <UserIcon /> },
  { id: 'plaque', title: 'Плашка', icon: <ImageIcon /> },
  { id: 'watermark', title: 'Ваш ник', icon: <Zap /> }
];

const SUBTITLE_STYLES = [
  { id: '1_word', name: '1 Слово', desc: 'Отображает по одному слову' },
  { id: 'karaoke', name: 'Караоке', desc: 'Классический стиль с караоке-выделением' },
  { id: '3_words', name: '3 Слова', desc: 'Отображает по три слова' },
];

const FONT_FAMILIES = [
  { id: 'Anton', name: 'Anton' },
  { id: 'Montserrat', name: 'Montserrat' },
  { id: 'Roboto', name: 'Roboto' },
  { id: 'Oswald', name: 'Oswald' }
];

export default function OnboardingWizard({ currentUser, authToken, plaques, onComplete }: OnboardingWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Helper to ensure valid hex color for preview and saving
  const getValidHex = (val: string | undefined, defaultHex: string) => {
    if (!val) return defaultHex;
    if (/^#[0-9A-F]{6}$/i.test(val)) return val;
    return defaultHex;
  };

  // States for the wizard
  const [subtitleStyle, setSubtitleStyle] = useState(currentUser.subtitle_style || 'karaoke');
  const [subtitleFontFamily, setSubtitleFontFamily] = useState(currentUser.subtitle_font_family || 'Anton');
  const [fontColor, setFontColor] = useState(getValidHex(currentUser.subtitle_font_color, '#FFFFFF'));
  const [highlightColor, setHighlightColor] = useState(getValidHex(currentUser.subtitle_highlight_color, '#FFFF00'));
  
  const [useFace, setUseFace] = useState(currentUser.use_face_in_carousels || false);
  
  const [defaultPlaqueId, setDefaultPlaqueId] = useState<string | null>(() => {
    if (currentUser.default_plaque_id) return currentUser.default_plaque_id;
    // When plaques are already available on first render, preselect one at random
    if (plaques.length > 0) {
      const randomIndex = Math.floor(Math.random() * plaques.length);
      return plaques[randomIndex].id;
    }
    return null;
  });
  const [plaquePosition, setPlaquePosition] = useState(currentUser.plaque_position || 'bottom');
  
  const [watermarkText, setWatermarkText] = useState(currentUser.watermark_text || `@${currentUser.username || currentUser.first_name || 'user'}`);
  const [watermarkPosition, setWatermarkPosition] = useState(currentUser.watermark_position || 'center');

  // If plaques arrive after initial render (e.g., fetched async) and the user has no default,
  // pick a random one exactly once to ensure the mandatory plaque step is preselected.
  React.useEffect(() => {
    if (defaultPlaqueId || currentUser.default_plaque_id) return;
    if (plaques.length === 0) return;
    const randomIndex = Math.floor(Math.random() * plaques.length);
    setDefaultPlaqueId(plaques[randomIndex].id);
  }, [plaques, defaultPlaqueId, currentUser.default_plaque_id]);

  const currentStep = STEPS[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleFinalSave();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      const settings = {
        watermark_text: watermarkText,
        watermark_position: watermarkPosition,
        subtitle_style: subtitleStyle,
        subtitle_font_family: subtitleFontFamily,
        subtitle_font_color: fontColor,
        subtitle_highlight_color: highlightColor,
        use_face_in_carousels: useFace,
        default_plaque_id: defaultPlaqueId,
        plaque_position: plaquePosition,
        // Default values for remaining schema fields
        subtitle_enabled: true,
        subtitle_font_size: 48,
        subtitle_position: '80',
        subtitle_outline_color: '#000000',
        subtitle_highlight_enabled: true,
        plaque_size: 80,
        plaque_timerange: 0,
        auto_mode_enabled: false,
        auto_mode_videos_per_day: 3,
        watermark_opacity: 0.08
      };

      const result = await api.users.saveSettings(settings);
      if (result.error) {
        alert(`Ошибка при сохранении: ${result.error}${result.details ? ': ' + JSON.stringify(result.details) : ''}`);
        return;
      }
      onComplete();
    } catch (e) {
      console.error(e);
      alert('Ошибка при сохранении.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0A0A] flex overflow-hidden">
      {/* Sidebar Progress */}
      <div className="w-80 bg-black/40 border-r border-white/5 p-12 flex flex-col justify-between hidden lg:flex">
        <div className="space-y-12">
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter text-white">
              EUGEN<span className="text-blue-600">.</span>SETUP
            </h1>
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Финализация вашего стиля</p>
          </div>

          <div className="space-y-6">
            {STEPS.map((step, idx) => (
              <div 
                key={step.id} 
                className={cn(
                  "flex items-center gap-4 transition-all duration-500",
                  idx === currentStepIndex ? "translate-x-2" : "opacity-30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
                  idx < currentStepIndex ? "bg-blue-600 border-blue-600 text-black" : 
                  idx === currentStepIndex ? "border-blue-600 text-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.2)]" : 
                  "border-white/10 text-white/40"
                )}>
                  {idx < currentStepIndex ? <Check className="w-5 h-5" /> : idx + 1}
                </div>
                <div>
                  <p className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    idx === currentStepIndex ? "text-white" : "text-white/40"
                  )}>{step.title}</p>
                  {idx === currentStepIndex && (
                    <motion.div layoutId="activeStep" className="h-0.5 bg-blue-600 mt-1 w-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 rounded-[2rem] bg-blue-600/5 border border-blue-600/10 relative overflow-hidden group">
          <Sparkles className="w-8 h-8 text-blue-600/20 absolute -right-2 -top-2 rotate-12 group-hover:scale-125 transition-transform duration-700" />
          <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest leading-relaxed">
            Мы настраиваем твой уникальный видео-стиль. Это займет всего минуту.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-4xl grid grid-cols-1 xl:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 text-blue-500 text-[10px] font-black uppercase tracking-widest mb-4">
                    Шаг {currentStepIndex + 1} из {STEPS.length}
                  </div>
                  <h2 className="text-4xl lg:text-5xl font-black italic uppercase tracking-tighter text-white leading-none">
                    {currentStep.title}
                  </h2>
                </div>

                {/* Step Forms */}
                <div className="space-y-6">
                  {currentStep.id === 'subtitles' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        {SUBTITLE_STYLES.map(style => (
                          <button
                            key={style.id}
                            onClick={() => setSubtitleStyle(style.id)}
                            className={cn(
                              "p-6 rounded-3xl border-2 text-left transition-all group",
                              subtitleStyle === style.id 
                                ? "bg-blue-600 border-blue-600 text-black shadow-2xl shadow-blue-600/20" 
                                : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                            )}
                          >
                            <div className="text-xs font-black uppercase tracking-widest mb-2">{style.name}</div>
                            <div className="text-[10px] leading-relaxed opacity-60 font-medium">{style.desc}</div>
                          </button>
                        ))}
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Выберите шрифт</label>
                        <div className="flex flex-wrap gap-2">
                          {FONT_FAMILIES.map(font => (
                            <button
                              key={font.id}
                              onClick={() => setSubtitleFontFamily(font.id)}
                              className={cn(
                                "px-6 py-3 rounded-2xl border-2 text-[10px] font-black uppercase transition-all",
                                subtitleFontFamily === font.id ? "bg-white/10 border-white text-white" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                              )}
                              style={{ fontFamily: font.id }}
                            >
                              {font.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep.id === 'branding' && (
                    <div className="space-y-8 p-8 rounded-[2rem] bg-white/5 border border-white/5">
                      <p className="text-lg text-white/60 leading-relaxed italic">
                        Мы можем автоматически добавлять ваше фото в карусели. Это сильно повышает <span className="text-blue-500 font-black">лояльность</span> и узнаваемость.
                      </p>
                      
                      <div className="flex items-center gap-4 p-6 rounded-2xl bg-black/40 border border-white/5">
                        <div className="p-4 rounded-xl bg-blue-600/10">
                          <UserIcon className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white mb-1">Использовать лицо в каруселях</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Можно настроить позже в профиле</p>
                        </div>
                        <button 
                          onClick={() => setUseFace(!useFace)}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-colors duration-300",
                            useFace ? "bg-blue-600" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                            useFace ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
                  )}

                  {currentStep.id === 'plaque' && (
                    <div className="space-y-8">
                       <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar p-1">
                        {plaques.map(plaque => (
                          <button
                            key={plaque.id}
                            onClick={() => setDefaultPlaqueId(plaque.id)}
                            className={cn(
                              "aspect-square p-4 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-4 group",
                              defaultPlaqueId === plaque.id ? "bg-blue-600 border-blue-600 text-black shadow-xl" : "bg-white/5 border-white/5"
                            )}
                          >
                            <img src={plaque.image_url} className={cn("w-full h-auto object-contain transition-transform", defaultPlaqueId === plaque.id && 'scale-110')} alt="" />
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100">{plaque.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Расположение на видео</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['top', 'center', 'bottom'].map(pos => (
                            <button
                              key={pos}
                              onClick={() => setPlaquePosition(pos)}
                              className={cn(
                                "py-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all",
                                plaquePosition === pos ? "bg-white/10 border-white text-white shadow-xl shadow-white/5" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                              )}
                            >
                              {pos === 'top' ? 'Сверху' : pos === 'center' ? 'В центре' : 'Снизу'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep.id === 'watermark' && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Текст знака (Ник)</label>
                        <input 
                          value={watermarkText}
                          onChange={e => setWatermarkText(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-xl font-black text-white focus:border-blue-600 outline-none transition-all italic tracking-tight"
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Позиция знака</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'top_left', label: 'L/T' },
                            { id: 'top_right', label: 'R/T' },
                            { id: 'center', label: 'MID' },
                            { id: 'bottom_left', label: 'L/B' },
                            { id: 'bottom_right', label: 'R/B' },
                            { id: 'tilted_center', label: 'TILT' }
                          ].map(pos => (
                            <button
                              key={pos.id}
                              onClick={() => setWatermarkPosition(pos.id)}
                              className={cn(
                                "py-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all",
                                watermarkPosition === pos.id ? "bg-white/10 border-white text-white" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                              )}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="pt-8 flex flex-col sm:flex-row gap-4">
              {currentStepIndex > 0 && (
                <button
                  onClick={handleBack}
                  className="px-10 py-5 rounded-[2rem] border border-white/10 text-white/40 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2 group"
                >
                  <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  Назад
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={saving}
                className="flex-1 px-10 py-5 rounded-[2rem] bg-blue-600 text-black text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-2xl shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="relative z-10">{currentStepIndex === STEPS.length - 1 ? 'Завершить настройку' : 'Следующий шаг'}</span>
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </div>
          </div>

          {/* Preview Mockup */}
          <div className="hidden xl:flex flex-col items-center space-y-6">
            <style>
              {`@import url('https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@900&family=Oswald:wght@700&display=swap');`}
            </style>
            
            <div className="relative group">
              <div className="absolute -inset-4 bg-blue-600/10 blur-3xl rounded-[4rem] group-hover:bg-blue-600/20 transition-all duration-1000" />
              <div className="relative aspect-[9/16] bg-black rounded-[3.5rem] border-[10px] border-white/10 overflow-hidden w-[340px] shadow-2xl">
                 <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80" alt="bg" className="w-full h-full object-cover opacity-40 blur-[2px] scale-105" />
                 
                 {/* Video UI Overlays */}
                 <div className="absolute inset-x-6 bottom-32 space-y-4">
                    <div className="h-2 bg-white/10 rounded-full w-2/3" />
                    <div className="h-2 bg-white/10 rounded-full w-1/2" />
                 </div>

                 {/* Plaque Preview */}
                 {defaultPlaqueId && (
                   <div className={cn(
                     "absolute left-6 right-6 z-20 transition-all duration-500 flex justify-center",
                     plaquePosition === 'top' ? 'top-12' : plaquePosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-20'
                   )}>
                     <img 
                       src={plaques.find(p => p.id === defaultPlaqueId)?.image_url} 
                       className="w-4/5 h-auto object-contain drop-shadow-2xl" 
                       alt="" 
                     />
                   </div>
                 )}

                 {/* Subtitles Preview */}
                 <div style={{ top: '75%', transform: 'translateY(-50%)' }} className="absolute inset-x-6 z-30 pointer-events-none">
                    <div 
                      className="text-center font-black uppercase leading-tight"
                      style={{ 
                        fontFamily: `"${subtitleFontFamily}", sans-serif`,
                        fontSize: '32px',
                        color: fontColor,
                        textShadow: subtitleStyle === 'karaoke' ? '0 4px 20px rgba(0,0,0,0.5)' : 'none'
                      }}
                    >
                      <span className={cn(subtitleStyle === 'celine' && 'tracking-[0.2em]')}>
                        {subtitleStyle === 'celine' ? 'VIBE CHECK' : (
                          <>
                            <span className="opacity-40">GO </span>
                            <span style={{ color: highlightColor }}>BEYOND </span>
                            <span className="opacity-40">LIMITS</span>
                          </>
                        )}
                      </span>
                    </div>
                 </div>

                 {/* Watermark Preview */}
                 <div 
                   className={cn(
                     "absolute z-40 text-[8px] font-black uppercase tracking-widest text-white/30 transition-all duration-500",
                     watermarkPosition === 'top_left' && 'top-10 left-8',
                     watermarkPosition === 'top_right' && 'top-10 right-8',
                     watermarkPosition === 'center' && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                     watermarkPosition === 'bottom_left' && 'bottom-12 left-8',
                     watermarkPosition === 'bottom_right' && 'bottom-12 right-8',
                     watermarkPosition === 'tilted_center' && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl opacity-10 rotate-[-35deg]'
                   )}
                 >
                   {watermarkText}
                 </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/5">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Живой предпросмотр вашего стиля</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
