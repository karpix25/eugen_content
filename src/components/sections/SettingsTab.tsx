import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  ImageIcon, 
  Zap, 
  Bot, 
  Loader2, 
  CheckCircle,
  User as UserIcon,
  Crown,
  ShieldCheck,
  CreditCard,
  Settings, 
  Bell, 
  ChevronRight, 
  TrendingUp, 
  Cpu, 
  Wand2,
  Globe
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { User, AdPlaque } from '../../types';
import { SubtitleSettings } from '../settings/SubtitleSettings';
import { PlaqueSettings } from '../settings/PlaqueSettings';
import { WatermarkSettings } from '../settings/WatermarkSettings';
import { AutoModeSettings } from '../settings/AutoModeSettings';
import { AIGeneratorSettings } from '../settings/AIGeneratorSettings';
import { PersonalBrandingSettings } from '../settings/PersonalBrandingSettings';
import { GlobalSettings } from '../settings/GlobalSettings';

interface SettingsTabProps {
  currentUser: User;
  authToken: string;
  onUpdate: () => void;
  plaques: AdPlaque[];
  onAddPlaque: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onDeletePlaque: (id: string) => Promise<void>;
}

export function SettingsTab({ 
  currentUser, 
  authToken, 
  onUpdate, 
  plaques, 
  onAddPlaque, 
  onDeletePlaque 
}: SettingsTabProps) {
  const [settingsSection, setSettingsSection] = useState<'subtitles' | 'plaque' | 'watermark' | 'auto' | 'ai_gen' | 'brand' | 'global'>('subtitles');
  
  // Settings State
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.08);
  const [watermarkPosition, setWatermarkPosition] = useState('center');
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [subtitleFontSize, setSubtitleFontSize] = useState(48);
  const [subtitleFontColor, setSubtitleFontColor] = useState('#FFFFFF');
  const [subtitlePosition, setSubtitlePosition] = useState('80');
  const [subtitleStyle, setSubtitleStyle] = useState('karaoke');
  const [subtitleFontFamily, setSubtitleFontFamily] = useState('Anton');
  const [subtitleHighlightColor, setSubtitleHighlightColor] = useState('#FFFF00');
  const [subtitleHighlightEnabled, setSubtitleHighlightEnabled] = useState(true);
  const [subtitleOutlineColor, setSubtitleOutlineColor] = useState('#000000');
  const [defaultPlaqueId, setDefaultPlaqueId] = useState<string | null>(null);
  const [plaquePosition, setPlaquePosition] = useState('bottom');
  const [plaqueSize, setPlaqueSize] = useState(80);
  const [plaqueTimerange, setPlaqueTimerange] = useState(0);
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);
  const [autoModeVideosPerDay, setAutoModeVideosPerDay] = useState(3);
  const [useFaceInCarousels, setUseFaceInCarousels] = useState(false);
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const getInitialPosition = (val: any) => {
    if (val === 'Bottom') return '80';
    if (val === 'Center') return '50';
    if (val === 'Top') return '15';
    const num = Number(val);
    return isNaN(num) ? '80' : num.toString();
  };

  useEffect(() => {
    if (currentUser) {
      setWatermarkText(currentUser.watermark_text !== null && currentUser.watermark_text !== undefined ? currentUser.watermark_text : `@${currentUser.username || currentUser.first_name}`);
      setWatermarkOpacity(currentUser.watermark_opacity !== undefined && currentUser.watermark_opacity !== null ? Number(currentUser.watermark_opacity) : 0.08);
      setWatermarkPosition(currentUser.watermark_position || 'center');
      setSubtitleEnabled(currentUser.subtitle_enabled !== false);
      setSubtitleFontSize(currentUser.subtitle_font_size ? Number(currentUser.subtitle_font_size) : 48);
      setSubtitleFontColor(currentUser.subtitle_font_color || '#FFFFFF');
      setSubtitlePosition(getInitialPosition(currentUser.subtitle_position));
      setSubtitleStyle(currentUser.subtitle_style || 'karaoke');
      setSubtitleFontFamily(currentUser.subtitle_font_family || 'Anton');
      setSubtitleHighlightColor(currentUser.subtitle_highlight_color || '#FFFF00');
      setSubtitleHighlightEnabled(currentUser.subtitle_highlight_enabled !== false);
      setSubtitleOutlineColor(currentUser.subtitle_outline_color || '#000000');
      setDefaultPlaqueId(currentUser.default_plaque_id || null);
      setPlaquePosition(currentUser.plaque_position || 'bottom');
      setPlaqueSize(currentUser.plaque_size !== undefined && currentUser.plaque_size !== null ? Number(currentUser.plaque_size) : 80);
      setPlaqueTimerange(currentUser.plaque_timerange !== undefined && currentUser.plaque_timerange !== null ? Number(currentUser.plaque_timerange) : 0);
      setAutoModeEnabled(currentUser.auto_mode_enabled || false);
      setAutoModeVideosPerDay(currentUser.auto_mode_videos_per_day !== undefined && currentUser.auto_mode_videos_per_day !== null ? Number(currentUser.auto_mode_videos_per_day) : 3);
      setUseFaceInCarousels(currentUser.use_face_in_carousels || false);
      setFaceImageUrl(currentUser.face_image_url || null);
    }
  }, [currentUser]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          watermark_text: watermarkText,
          watermark_opacity: watermarkOpacity,
          watermark_position: watermarkPosition,
          subtitle_enabled: subtitleEnabled,
          subtitle_font_size: subtitleFontSize,
          subtitle_font_color: subtitleFontColor,
          subtitle_position: subtitlePosition,
          subtitle_style: subtitleStyle,
          subtitle_font_family: subtitleFontFamily,
          subtitle_highlight_color: subtitleHighlightColor,
          subtitle_highlight_enabled: subtitleHighlightEnabled,
          subtitle_outline_color: subtitleOutlineColor,
          default_plaque_id: defaultPlaqueId,
          plaque_position: plaquePosition,
          plaque_size: plaqueSize,
          plaque_timerange: plaqueTimerange,
          auto_mode_enabled: autoModeEnabled,
          auto_mode_videos_per_day: autoModeVideosPerDay,
          use_face_in_carousels: useFaceInCarousels
        })
      });
      if (res.ok) {
        onUpdate();
      } else {
        alert('Ошибка при сохранении.');
      }
    } catch (e) {
      alert('Ошибка при сохранении.');
    } finally {
      setSaving(false);
    }
  };

  const SETTINGS_TABS = [
    { id: 'subtitles' as const, label: 'Субтитры', icon: <Layers className="w-4 h-4" /> },
    { id: 'brand' as const, label: 'Бренд', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'plaque' as const, label: 'Плашка', icon: <ImageIcon className="w-4 h-4" /> },
    ...(currentUser.is_admin ? [
      { id: 'ai_gen' as const, label: 'Генератор плашек', icon: <Wand2 className="w-4 h-4" /> }
    ] : []),
    { id: 'watermark' as const, label: 'Водяной знак', icon: <Zap className="w-4 h-4" /> },
    { id: 'auto' as const, label: 'Авто-режим', icon: <Bot className="w-4 h-4" /> },
    ...(currentUser.is_admin ? [
      { id: 'global' as const, label: 'Глобальные', icon: <Globe className="w-4 h-4" /> }
    ] : []),
  ];

  const FONT_FAMILIES = [
    { id: 'Anton', name: 'Anton', googleUrl: 'Anton' },
    { id: 'Montserrat', name: 'Montserrat', googleUrl: 'Montserrat:wght@900' },
    { id: 'Roboto', name: 'Roboto Black', googleUrl: 'Roboto:wght@900' },
    { id: 'Oswald', name: 'Oswald', googleUrl: 'Oswald:wght@700' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Profile Header Block */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#111] to-[#050505] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] -mr-48 -mt-48 rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 blur-[80px] -ml-32 -mb-32 rounded-full pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-1 shadow-xl shadow-emerald-500/20 rotate-3">
              <div className="w-full h-full bg-[#0A0A0A] rounded-[1.4rem] flex items-center justify-center -rotate-3 overflow-hidden">
                {currentUser.username ? (
                  <span className="text-3xl font-black text-emerald-500">{currentUser.username[0].toUpperCase()}</span>
                ) : (
                  <UserIcon className="w-10 h-10 text-emerald-500" />
                )}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-black p-1.5 rounded-xl shadow-lg border-4 border-[#0A0A0A]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
              {currentUser.first_name || currentUser.username}
              <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border border-emerald-500/20">
                {currentUser.role || 'PRO'}
              </span>
            </h1>
            <p className="text-white/40 text-xs font-medium uppercase tracking-[0.2em]">
              ID: {currentUser.telegram_id || 'NANOBANANA_BASE'} • {currentUser.is_admin ? 'ADMINISTRATOR' : 'WORKER'}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{currentUser.publication_count || 0} ПУБЛИКАЦИЙ</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <Cpu className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">AUTO: {currentUser.auto_mode_enabled ? 'ON' : 'OFF'}</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto">
            {/* Premium card removed based on user request */}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Settings Controls */}
        <div className="xl:col-span-12">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64 shrink-0 space-y-4">
              <div className="bg-white/5 rounded-[2rem] p-4 space-y-2 border border-white/10 backdrop-blur-xl">
                <p className="px-4 text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Меню настроек</p>
                {SETTINGS_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsSection(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3.5 rounded-[1.25rem] transition-all duration-300 relative group",
                      settingsSection === tab.id
                        ? "bg-emerald-500 text-black shadow-xl shadow-emerald-500/20"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-colors duration-300",
                      settingsSection === tab.id ? "bg-black/10" : "bg-white/5 group-hover:bg-white/10"
                    )}>
                      {tab.icon}
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap text-left flex-1">{tab.label}</span>
                    {settingsSection === tab.id && (
                      <div className="absolute right-4">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full py-5 rounded-[2rem] bg-emerald-500 text-black font-black uppercase tracking-[0.25em] text-[10px] hover:bg-emerald-400 transition-all shadow-[0_20px_40px_rgba(16,185,129,0.15)] disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95 group"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 transition-transform group-hover:scale-125" />
                )}
                {saving ? 'СОХРАНЯЕМ...' : 'СОХРАНИТЬ'}
              </button>
            </div>

            <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-right-4 duration-1000">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {settingsSection === 'subtitles' && (
                    <SubtitleSettings 
                      enabled={subtitleEnabled} setEnabled={setSubtitleEnabled}
                      style={subtitleStyle} setStyle={setSubtitleStyle}
                      fontFamily={subtitleFontFamily} setFontFamily={setSubtitleFontFamily}
                      fontSize={subtitleFontSize} setFontSize={setSubtitleFontSize}
                      position={subtitlePosition} setPosition={setSubtitlePosition}
                      fontColor={subtitleFontColor} setFontColor={setSubtitleFontColor}
                      outlineColor={subtitleOutlineColor} setOutlineColor={setSubtitleOutlineColor}
                      highlightEnabled={subtitleHighlightEnabled} setHighlightEnabled={setSubtitleHighlightEnabled}
                      highlightColor={subtitleHighlightColor} setHighlightColor={setSubtitleHighlightColor}
                    />
                  )}

                  {settingsSection === 'plaque' && (
                    <PlaqueSettings 
                      plaques={plaques}
                      defaultPlaqueId={defaultPlaqueId} setDefaultPlaqueId={setDefaultPlaqueId}
                      position={plaquePosition} setPosition={setPlaquePosition}
                      size={plaqueSize} setSize={setPlaqueSize}
                      timerange={plaqueTimerange} setTimerange={setPlaqueTimerange}
                      onAddPlaque={onAddPlaque}
                      onDeletePlaque={onDeletePlaque}
                      isAdmin={currentUser.is_admin}
                    />
                  )}

                  {settingsSection === 'brand' && (
                    <PersonalBrandingSettings
                      useFaceInCarousels={useFaceInCarousels}
                      setUseFaceInCarousels={setUseFaceInCarousels}
                      faceImageUrl={faceImageUrl}
                      telegramId={currentUser.telegram_id}
                      authToken={authToken}
                      onUpdate={onUpdate}
                    />
                  )}

                  {settingsSection === 'watermark' && (
                    <WatermarkSettings 
                      text={watermarkText} setText={setWatermarkText}
                      opacity={watermarkOpacity} setOpacity={setWatermarkOpacity}
                      position={watermarkPosition} setPosition={setWatermarkPosition}
                    />
                  )}

                  {settingsSection === 'auto' && (
                    <AutoModeSettings 
                      enabled={autoModeEnabled} setEnabled={setAutoModeEnabled}
                      videosPerDay={autoModeVideosPerDay} setVideosPerDay={setAutoModeVideosPerDay}
                    />
                  )}

                  {settingsSection === 'ai_gen' && currentUser.is_admin && (
                    <AIGeneratorSettings 
                      authToken={authToken}
                      onUpdate={onUpdate}
                    />
                  )}

                  {settingsSection === 'global' && currentUser.is_admin && (
                    <GlobalSettings 
                      authToken={authToken}
                    />
                  )}


                </div>

                <div className="space-y-6 flex flex-col items-center">
                  <style>
                    {`@import url('https://fonts.googleapis.com/css2?family=${FONT_FAMILIES.find(f => f.id === subtitleFontFamily)?.googleUrl || 'Anton'}&display=swap');`}
                  </style>
                  
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-purple-500 rounded-[3.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative aspect-[9/16] bg-[#000] rounded-[3rem] overflow-hidden border-[8px] border-white/10 w-full max-w-[340px] shadow-2xl">
                      <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80" alt="bg" className="w-full h-full object-cover opacity-60 scale-105 blur-[2px]" />

                      {/* Video Player Mock Controls */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />
                      
                      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-30 opacity-60 scale-75">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"><Zap className="w-4 h-4 fill-white" /></div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"><ImageIcon className="w-4 h-4 fill-white" /></div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"><Bot className="w-4 h-4 fill-white" /></div>
                      </div>

                      {defaultPlaqueId && plaques.find(p => p.id === defaultPlaqueId) && (
                        <div className={cn(
                          "absolute left-0 right-0 z-20 flex justify-center px-6 transition-all duration-700 pointer-events-none drop-shadow-2xl",
                          plaquePosition === 'top' ? 'top-10' : plaquePosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-20'
                        )}>
                          <img
                            src={plaques.find(p => p.id === defaultPlaqueId)?.image_url}
                            className="h-auto object-contain animate-in zoom-in-75 duration-500"
                            style={{ width: `${plaqueSize}%` }}
                            alt=""
                          />
                        </div>
                      )}

                      <div
                        className="absolute left-0 right-0 flex justify-center px-6 z-10 transition-all duration-700 pointer-events-none"
                        style={{
                          top: `${subtitlePosition}%`,
                          transform: 'translateY(-50%)'
                        }}
                      >
                        <div
                          className="inline-block px-4 py-2 font-black leading-tight text-center"
                          style={{
                            fontFamily: `"${subtitleFontFamily}", sans-serif`,
                            fontSize: `${Math.max(14, subtitleFontSize * 0.75)}px`,
                            textShadow: (subtitleStyle === 'karaoke') ? `0px 2px 10px ${subtitleOutlineColor}` : 'none',
                            color: '#FFFFFF',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.02em'
                          }}
                        >
                          {subtitleStyle === 'celine' ? (
                            <span className="tracking-wider">КАЧЕСТВЕННЫЙ КОНТЕНТ</span>
                          ) : (
                            <>
                              <span style={{ display: 'inline-block' }}>ТВОЙ </span>
                              <span
                                style={{
                                  color: (subtitleHighlightEnabled ? subtitleHighlightColor : subtitleFontColor),
                                  display: 'inline-block',
                                  margin: '0 4px',
                                }}
                              >ЛУЧШИЙ</span>
                              <span style={{ display: 'inline-block' }}> ШОТС</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "absolute font-black text-white/50 uppercase whitespace-nowrap tracking-[0.3em] transition-all duration-700 pointer-events-none",
                          watermarkPosition === 'top_left' ? 'top-10 left-8' :
                            watermarkPosition === 'top_right' ? 'top-10 right-8' :
                              watermarkPosition === 'bottom_left' ? 'bottom-16 left-8' :
                                watermarkPosition === 'bottom_right' ? 'bottom-16 right-8' :
                                  'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                        )}
                        style={{
                          opacity: watermarkOpacity,
                          fontSize: watermarkPosition === 'tilted_center' ? '32px' : '9px',
                          transform: (watermarkPosition === 'center' || watermarkPosition === 'tilted_center')
                            ? `translate(-50%, -50%) ${watermarkPosition === 'tilted_center' ? 'rotate(-35deg)' : ''}`
                            : 'none'
                        }}
                      >
                        {watermarkText}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
