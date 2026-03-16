import React, { useState, useEffect, useRef } from 'react';
import { Video, LayoutGrid, Folder as FolderIcon, ChevronLeft } from 'lucide-react';
import { Clip, AdPlaque } from '../../types';
import { ClipCard } from '../clips/ClipCard';
import { ClipFilters } from '../clips/ClipFilters';
import { FolderCard } from '../clips/FolderCard';
import { cn } from '../../lib/utils';

interface ClipsTabProps {
  clips: Clip[];
  totalClips: number;
  loadMoreClips: () => void;
  plaques: AdPlaque[];
  authToken: string | null;
  onUpdate: () => void;
  isAdmin: boolean;
  onOpenCarouselWizard: (clip: Clip) => void;
  loading?: boolean;
  onTogglePublic: (id: string, isPublic: boolean) => void;
  onToggleFolderPublic: (id: string, isPublic: boolean) => void;
  currentUserProfile: any;
}

export function ClipsTab({ 
  clips, 
  totalClips,
  loadMoreClips,
  plaques, 
  authToken, 
  onUpdate, 
  isAdmin,
  onOpenCarouselWizard,
  loading,
  onTogglePublic,
  onToggleFolderPublic,
  currentUserProfile
}: ClipsTabProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'new' | 'published'>('new');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'ru' | 'en'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'folder'>('folder');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && clips.length < totalClips && !loading && !selectedFolderId) {
          loadMoreClips();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [clips.length, totalClips, loading, loadMoreClips, selectedFolderId]);

  const visibleClips = clips.filter(c => {
    if (filterMode === 'new' && c.is_available === false) return false;
    if (filterMode === 'published' && c.is_available === true) return false;
    if (languageFilter !== 'all' && c.language !== languageFilter) return false;
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.transcript?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Grouping logic for Folder View
  const folders = visibleClips.reduce((acc: Record<string, { id: string, title: string, thumbnail?: string, clips: Clip[], isPublic?: boolean }>, clip) => {
    const videoId = clip.video_id;
    if (!acc[videoId]) {
      acc[videoId] = {
        id: videoId,
        title: (clip as any).video_title || 'Unknown Video',
        thumbnail: (clip as any).video_thumbnail,
        isPublic: !!clip.video_is_public,
        clips: []
      };
    }
    acc[videoId].clips.push(clip);
    return acc;
  }, {});


  const displayedClips = selectedFolderId 
    ? visibleClips.filter(c => c.video_id === selectedFolderId)
    : visibleClips;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <ClipFilters 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          languageFilter={languageFilter}
          onLanguageChange={setLanguageFilter}
        />
        
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0 self-start md:self-center">
          <button
            onClick={() => { setViewMode('folder'); setSelectedFolderId(null); }}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
              viewMode === 'folder' ? "bg-blue-600 text-black shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            <FolderIcon className="w-4 h-4" />
            ПАПКИ
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
              viewMode === 'grid' ? "bg-blue-600 text-black shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            СЕТКА
          </button>
        </div>
      </div>

      {viewMode === 'folder' && selectedFolderId && (
        <button 
          onClick={() => setSelectedFolderId(null)}
          className="flex items-center gap-2 text-white/40 hover:text-blue-500 transition-colors text-sm font-bold group"
        >
          <div className="bg-white/5 border border-white/10 p-1.5 rounded-lg group-hover:border-blue-600/50">
            <ChevronLeft className="w-4 h-4" />
          </div>
          Назад к папкам
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {viewMode === 'folder' && !selectedFolderId ? (
          Object.values(folders).map(folder => (
            <FolderCard
              key={folder.id}
              videoId={folder.id}
              videoTitle={folder.title}
              videoThumbnail={folder.thumbnail}
              isPublic={folder.isPublic}
              clips={folder.clips}
              onClick={() => setSelectedFolderId(folder.id)}
              onTogglePublic={isAdmin ? (e) => {
                e.stopPropagation();
                onToggleFolderPublic(folder.id, !folder.isPublic);
              } : undefined}
            />
          ))
        ) : (
          displayedClips.map(clip => (
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
              onTogglePublic={onTogglePublic}
              currentUserProfile={currentUserProfile}
            />
          ))
        )}

        {(viewMode === 'grid' || selectedFolderId) && displayedClips.length === 0 && (
          <div className="col-span-full py-20 text-center text-white/20">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Подходящих нарезок пока нет.</p>
          </div>
        )}

        {viewMode === 'folder' && !selectedFolderId && Object.keys(folders).length === 0 && (
          <div className="col-span-full py-20 text-center text-white/20">
            <FolderIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Папок пока нет.</p>
          </div>
        )}
      </div>

      {clips.length < totalClips && !selectedFolderId && (
        <div ref={observerTarget} className="flex justify-center pt-8 pb-12">
          <div className="w-8 h-8 border-4 border-white/10 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
