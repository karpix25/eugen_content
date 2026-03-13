import React, { useState } from 'react';
import { UserPlus, Shield, UserPen, Trash2, Check, X, Loader2 } from 'lucide-react';
import { User } from '../../types';

interface UsersTabProps {
  users: User[];
  onUpdate: () => void;
  authToken: string;
}

export function UsersTab({ users, onUpdate, authToken }: UsersTabProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const toggleAdmin = async (user: User) => {
    setLoading(user.telegram_id);
    try {
      const res = await fetch(`/api/admin/users/${user.telegram_id}/toggle-admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Удалить пользователя ${user.username}?`)) return;
    setLoading(user.telegram_id);
    try {
      const res = await fetch(`/api/admin/users/${user.telegram_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Управление авторами</h2>
          <p className="text-white/40 text-sm">Список пользователей системы и управление правами</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {users.map((user) => (
          <div key={user.telegram_id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:border-white/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xl border border-emerald-500/20">
                {user.first_name?.[0] || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold">{user.first_name}</h4>
                  {user.is_admin && (
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase rounded tracking-wider border border-emerald-500/20 flex items-center gap-1">
                      <Shield className="w-2 h-2" /> Admin
                    </span>
                  )}
                </div>
                <p className="text-white/40 text-xs">@{user.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleAdmin(user)}
                disabled={loading === user.telegram_id}
                className={`p-2 rounded-xl transition-all ${user.is_admin ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                title={user.is_admin ? "Убрать админа" : "Сделать админом"}
              >
                {loading === user.telegram_id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => deleteUser(user)}
                disabled={loading === user.telegram_id}
                className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"
                title="Удалить"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
