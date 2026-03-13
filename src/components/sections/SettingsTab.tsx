import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  ImageIcon, 
  Zap, 
  Bot, 
  Loader2, 
  CheckCircle 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { User, AdPlaque } from '../../types';
import { SubtitleSettings } from './SubtitleSettings';
import { PlaqueSettings } from './PlaqueSettings';
import { WatermarkSettings } from './WatermarkSettings';
import { AutoModeSettings } from './AutoModeSettings';

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
  const [settingsSection, setSettingsSection] = useState<'subtitles' | 'plaque' | 'watermark' | 'auto'>('subtitles');
  
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
          auto_mode_videos_per_day: autoModeVideosPerDay
        })
      });
      if (res.ok) {
        alert('Настройки сохранены!');
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
    { id: 'plaque' as const, label: 'Плашка', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'watermark' as const, label: 'Водяной знак', icon: <Zap className="w-4 h-4" /> },
    { id: 'auto' as const, label: 'Авто-режим', icon: <Bot className="w-4 h-4" /> },
  ];

  const FONT_FAMILIES = [
    { id: 'Anton', name: 'Anton', googleUrl: 'Anton' },
    { id: 'Montserrat', name: 'Montserrat', googleUrl: 'Montserrat:wght@900' },
    { id: 'Roboto', name: 'Roboto Black', googleUrl: 'Roboto:wght@900' },
    { id: 'Oswald', name: 'Oswald', googleUrl: 'Oswald:wght@700' }
  ];

  return (
    <div className="max-w-4xl mx-auto pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1.5">
            {SETTINGS_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSettingsSection(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all",
                  settingsSection === tab.id
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

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

          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.3em] text-xs hover:bg-emerald-400 transition-all shadow-[0_15px_40px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-3 group"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 transition-transform group-hover:scale-110" />}
            {saving ? 'СОХРАНЕНИЕ...' : 'ПРИМЕНИТЬ ДЛЯ ВСЕХ ВИДЕО'}
          </button>
        </div>

        <div className="space-y-6">
          <div className="sticky top-24 space-y-4">
            <div className="flex flex-col items-center">
              <style>
                {`@import url('https://fonts.googleapis.com/css2?family=${FONT_FAMILIES.find(f => f.id === subtitleFontFamily)?.googleUrl || 'Anton'}&display=swap');`}
              </style>
              <div className="flex items-center gap-2 mb-3 self-start md:self-center">
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                <span className="block text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">ФИНАЛЬНЫЙ ПРЕДПРОСМОТР</span>
              </div>

              <div className="relative aspect-[9/16] bg-[#000] rounded-[3rem] overflow-hidden border-[6px] border-white/10 w-full max-w-[320px] shadow-[0_0_120px_rgba(0,0,0,0.8)]">
                <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80" alt="bg" className="w-full h-full object-cover opacity-50 scale-105 blur-[2px]" />

                {defaultPlaqueId && plaques.find(p => p.id === defaultPlaqueId) && (
                  <div className={cn(
                    "absolute left-0 right-0 z-20 flex justify-center px-4 transition-all duration-500 pointer-events-none",
                    plaquePosition === 'top' ? 'top-8' : plaquePosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-12'
                  )}>
                    <img
                      src={plaques.find(p => p.id === defaultPlaqueId)?.image_url}
                      className="h-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-xl object-contain"
                      style={{ width: `${plaqueSize}%` }}
                      alt=""
                    />
                  </div>
                )}

                <div
                  className="absolute left-0 right-0 flex justify-center px-4 z-10 transition-all duration-500"
                  style={{
                    top: `${subtitlePosition}%`,
                    transform: 'translateY(-50%)'
                  }}
                >
                  <div
                    className="inline-block px-3 py-1 font-bold"
                    style={{
                      fontFamily: `"${subtitleFontFamily}", sans-serif`,
                      fontSize: `${Math.max(12, subtitleFontSize * 0.8)}px`,
                      borderRadius: '6px',
                      textShadow: (subtitleStyle === 'karaoke') ? `1px 1px 4px ${subtitleOutlineColor}` : 'none',
                      color: '#FFFFFF',
                      textTransform: 'none',
                      letterSpacing: 'normal'
                    }}
                  >
                    {subtitleStyle === 'celine' ? (
                      <span className="tracking-[0.1em]">ОБЫЧНЫЕ СУБТИТРЫ</span>
                    ) : (
                      <>
                        <span style={{ display: 'inline-block' }}>ЛУЧШИЙ </span>
                        <span
                          style={{
                            color: (subtitleHighlightEnabled ? subtitleHighlightColor : subtitleFontColor),
                            display: 'inline-block',
                            fontWeight: 'bold',
                            margin: '0 8px',
                          }}
                        >РЕЗУЛЬТАТ</span>
                      </>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "absolute font-black text-white whitespace-nowrap tracking-[0.2em] transition-all duration-700",
                    watermarkPosition === 'top_left' ? 'top-8 left-8' :
                      watermarkPosition === 'top_right' ? 'top-8 right-8' :
                        watermarkPosition === 'bottom_left' ? 'bottom-12 left-8' :
                          watermarkPosition === 'bottom_right' ? 'bottom-12 right-8' :
                            'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                  )}
                  style={{
                    opacity: watermarkOpacity,
                    fontSize: watermarkPosition === 'tilted_center' ? '48px' : '12px',
                    transform: (watermarkPosition === 'center' || watermarkPosition === 'tilted_center')
                      ? `translate(-50%, -50%) ${watermarkPosition === 'tilted_center' ? 'rotate(-35deg)' : ''}`
                      : 'none'
                  }}
                >
                  {watermarkText}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 justify-center">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-black bg-emerald-500/20 flex items-center justify-center">
                      <Zap className="w-2.5 h-2.5 text-emerald-500" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Ready for Reels / TikTok</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
