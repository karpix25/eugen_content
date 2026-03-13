import React from 'react';
import { ChevronRight } from 'lucide-react';
import { User } from '../../types';
import { cn } from '../../lib/utils';

interface WorkersTabProps {
  users: User[];
  setSelectedWorker: (user: User) => void;
  handleAuthorize: (telegramId: string, authorized: boolean) => void;
}

export function WorkersTab({ 
  users, 
  setSelectedWorker, 
  handleAuthorize 
}: WorkersTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Пользователь</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Telegram ID</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40 text-center">Всего видео</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Статус</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/40">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user.telegram_id} className="hover:bg-white/5 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-medium text-emerald-400">{user.first_name}</div>
                  <div className="text-xs text-white/40">@{user.username || 'n/a'}</div>
                </td>
                <td className="px-6 py-4 font-mono text-sm text-white/60">{user.telegram_id}</td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => setSelectedWorker(user)}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-full transition-all"
                  >
                    <span className="font-bold text-sm text-white">{user.publication_count || 0}</span>
                    <ChevronRight className="w-3 h-3 text-white/40 group-hover:text-emerald-500 transition-colors" />
                  </button>
                </td>
                <td className="px-6 py-4">
                  {user.is_authorized ? (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold uppercase">Авторизован</span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-bold uppercase">В ожидании</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleAuthorize(user.telegram_id, !user.is_authorized)}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-bold transition-colors",
                        user.is_authorized ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-emerald-500 text-black hover:bg-emerald-400"
                      )}
                    >
                      {user.is_authorized ? "Деавторизовать" : "Авторизовать"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-20 text-center text-white/20">
            <p>Пользователей пока нет. Работники должны нажать /start в боте.</p>
          </div>
        )}
      </div>
    </div>
  );
}
