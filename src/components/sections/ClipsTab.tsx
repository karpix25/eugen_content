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
  onOpenCarouselWizard: (clip: Clip) => void;
}

export function ClipsTab({ 
  clips, 
  plaques, 
  authToken, 
  onUpdate, 
  isAdmin,
  onOpenCarouselWizard
}: ClipsTabProps) {
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'ru' | 'en'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const visibleClips = clips.filter(c => {
    // If showAvailableOnly is on, only hide if explicitly FALSE
    if (showAvailableOnly && c.is_available === false) return false;
    if (languageFilter !== 'all' && c.language !== languageFilter) return false;
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.transcript?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
              const res = await fetch(`/api/clips/${clipId}/apply-plaque`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}` 
                },
                body: JSON.stringify({ plaque_id: plaqueId })
              });
              if (res.ok) {
                alert("Видео успешно отправлено вам в Telegram!");
                onUpdate();
              } else {
                const e = await res.json();
                alert(e.error || "Ошибка при генерации");
              }
            }}
            onSendCarousel={() => onOpenCarouselWizard(clip)}
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
