import { Folder, Film, Calendar, Globe, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { Clip } from '../../types';
import { cn } from '../../lib/utils';

interface FolderCardProps {
  videoId: string;
  videoTitle: string;
  videoThumbnail?: string;
  isPublic?: boolean;
  clips: Clip[];
  onClick: () => void;
  onTogglePublic?: (e: React.MouseEvent) => void;
}

export function FolderCard({
  videoTitle,
  videoThumbnail,
  isPublic,
  clips,
  onClick,
  onTogglePublic
}: FolderCardProps) {
  const lastUpdate = clips.length > 0 
    ? new Date(Math.max(...clips.map(c => new Date(c.created_at || 0).getTime())))
    : null;

  const languages = Array.from(new Set(clips.map(c => c.language).filter(Boolean)));

  return (
    <div 
      onClick={onClick}
      className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex flex-col h-full"
    >
      <div className="relative aspect-video overflow-hidden bg-black">
        {videoThumbnail ? (
          <img 
            src={videoThumbnail} 
            alt={videoTitle}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Folder className="w-12 h-12 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
        
        <div className="absolute top-3 left-3 flex gap-2">
          {onTogglePublic ? (
            <button
              onClick={onTogglePublic}
              className={cn(
                "p-2 rounded-lg backdrop-blur-md border transition-all shadow-lg",
                isPublic 
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30" 
                  : "bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30"
              )}
              title={isPublic ? "Сделать приватной" : "Сделать публичной"}
            >
              {isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          ) : (
            <div className={cn(
              "p-2 rounded-lg backdrop-blur-md border shadow-lg",
              isPublic 
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                : "bg-amber-500/20 border-amber-500/50 text-amber-400"
            )}>
              {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
          )}
        </div>

        <div className="absolute top-3 right-3 flex gap-2">
          <span className="bg-emerald-500 text-black text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
            <Film className="w-3 h-3" />
            {clips.length}
          </span>
        </div>

        {languages.length > 0 && (
          <div className="absolute bottom-3 left-3 flex gap-1">
            {languages.map(lang => (
              <span key={lang} className="bg-white/10 backdrop-blur-md text-white/90 text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 uppercase">
                <Globe className="w-3 h-3" />
                {lang}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-emerald-400 transition-colors">
          {videoTitle}
        </h3>
        
        <div className="mt-auto flex items-center justify-between text-[10px] text-white/40 font-medium">
          {lastUpdate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {lastUpdate.toLocaleDateString('ru-RU')}
            </div>
          )}
          <div className="text-emerald-500/60 font-bold group-hover:text-emerald-400">
            ОТКРЫТЬ
          </div>
        </div>
      </div>
    </div>
  );
}
