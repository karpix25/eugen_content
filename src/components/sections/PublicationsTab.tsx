import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Publication } from '../../types';

interface PublicationsTabProps {
  publications: Publication[];
  authToken?: string;
  isAdmin?: boolean;
}

export function PublicationsTab({ publications, authToken, isAdmin }: PublicationsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Публикации</h2>
          <p className="text-white/40 text-sm">Отслеживание отправленных видео и ссылок от пользователей</p>
        </div>
      </div>


      <div className="grid grid-cols-1 gap-4">
        {publications.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <ExternalLink className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 font-medium">Пока нет зафиксированных публикаций</p>
          </div>
        )}
        {publications.map((pub) => (
          <div key={pub.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-6 hover:border-emerald-500/30 transition-all group">


            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-lg mb-1 line-clamp-1">{pub.clip_title}</h4>
                  <div className="flex items-center gap-2 text-sm text-white/40">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px] font-bold text-emerald-500 border border-emerald-500/20">
                      {pub.first_name?.[0] || 'U'}
                    </div>
                    <span className="font-medium text-white/70">{pub.first_name}</span>
                    <span className="opacity-50">@{pub.username}</span>
                    <span>•</span>
                    <span>{format(new Date(pub.created_at), 'dd.MM, HH:mm')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {pub.status === 'published' ? (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase">Опубликовано</span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full font-bold uppercase">Отправлено</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {pub.social_links.map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noreferrer" className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-emerald-400 hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Ссылка {i + 1}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
