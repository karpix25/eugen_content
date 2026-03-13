import React, { useState } from 'react';
import { Video } from 'lucide-react';
import { Clip, AdPlaque } from '../../types';
import { ClipCard } from '../clips/ClipCard';
import { ClipFilters } from '../clips/ClipFilters';
import { cn } from '../../lib/utils';

interface ClipsTabProps {
  clips: Clip[];
  plaques: AdPlaque[];
  authToken: string | null;
  onUpdate: () => void;
  isAdmin: boolean;
}

export function ClipsTab({ 
  clips, 
  plaques, 
  authToken, 
  onUpdate, 
  isAdmin 
}: ClipsTabProps) {
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'ru' | 'en'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const visibleClips = clips.filter(c => {
    if (showAvailableOnly && !c.is_available) return false;
    if (languageFilter !== 'all' && c.language !== languageFilter) return false;
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.transcript?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleSendToTelegram = async (clipId: string, plaqueId: string | null) => {
    try {
      const head = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const payload: any = { plaque_id: plaqueId };
      const r = await fetch(`/api/clips/${clipId}/apply-plaque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...head },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const e = await r.json();
        alert(e.error || "Ошибка при генерации");
      } else {
        alert("Видео успешно отправлено вам в Telegram!");
        onUpdate(); // Changed from fetchData() to onUpdate()
      }
    } catch (e) {
      alert("Ошибка сети при отправке видео");
    }
  };

  return (
    <div className="space-y-6">
      <ClipFilters 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showAvailableOnly={showAvailableOnly}
        onShowAvailableChange={setShowAvailableOnly}
        languageFilter={languageFilter}
        onLanguageChange={setLanguageFilter}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleClips.map(clip => (
          <ClipCard
            key={clip.id}
            clip={clip}
            plaques={plaques}
            onSendToTelegram={async (clipId, plaqueId) => {
              const res = await fetch('/api/clips/send-to-telegram', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}` 
                },
                body: JSON.stringify({ clipId, plaqueId })
              });
              if (res.ok) onUpdate();
            }}
            onSendCarousel={async (clipId) => {
              const res = await fetch('/api/clips/send-carousel', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}` 
                },
                body: JSON.stringify({ clipId })
              });
              if (res.ok) onUpdate();
            }}
          />
        ))}
        {visibleClips.length === 0 && (
          <div className="col-span-full py-20 text-center text-white/20">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Подходящих нарезок пока нет.</p>
          </div>
        )}
      </div>
    </div>
  );
}
