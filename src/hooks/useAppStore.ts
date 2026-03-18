import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useAppData } from './useAppData';
import { api } from '../services/api';

const ACTIVE_TAB_STORAGE_KEY = 'app_active_tab';

const getInitialActiveTab = () => {
  return localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || 'clips';
};

const getValidActiveTab = (tab: string, isAdmin?: boolean) => {
  const allowedTabs = isAdmin
    ? ['monitor', 'dashboard', 'clips', 'workers', 'settings', 'styles']
    : ['monitor', 'clips', 'settings'];

  return allowedTabs.includes(tab) ? tab : 'clips';
};

export function useAppStore() {
  const { authToken, currentUser, handleLogin, handleLogout, verifyAuth } = useAuth();
  const data = useAppData(authToken, currentUser, handleLogout);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTabState] = useState(getInitialActiveTab);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [manualYoutubeUrl, setManualYoutubeUrl] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const nextTab = getValidActiveTab(activeTab, currentUser?.is_admin);
    if (nextTab !== activeTab) {
      setActiveTabState(nextTab);
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, nextTab);
    }
  }, [activeTab, currentUser?.is_admin]);

  const setActiveTab = useCallback((tab: string) => {
    const nextTab = getValidActiveTab(tab, currentUser?.is_admin);
    setActiveTabState(nextTab);
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, nextTab);
  }, [currentUser?.is_admin]);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  // Mutations
  const addPlaqueMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/ad-plaques', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      });
      if (!res.ok) throw new Error('Failed to add plaque');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaques'] });
    }
  });

  const deletePlaqueMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ad-plaques/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to delete plaque');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaques'] });
    }
  });

  const videoActionMutation = useMutation({
    mutationFn: async ({ id, action, body }: { id: string, action: string, body?: any }) => {
      setProcessingId(id);
      const res = await fetch(`/api/videos/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) throw new Error(`Failed to ${action} video`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['clips'] });
    },
    onSettled: () => setProcessingId(null)
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { status: res.status, ...errData };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
    onError: (err: any) => {
      if (err.status === 403) alert('У вас нет прав на удаление этого видео.');
      else alert(`Ошибка при удалении видео: ${err.error || 'Неизвестная ошибка'}`);
    }
  });

  const channelMutation = useMutation({
    mutationFn: async ({ url, interval, scrapeDays }: { url: string, interval: string, scrapeDays: number }) => {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ id: url, monitoring_interval: interval, scrape_days: scrapeDays })
      });
      if (!res.ok) throw new Error('Failed to add channel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    }
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/channels/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { status: res.status, ...errData };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
    onError: (err: any) => {
      if (err.status === 403) alert('У вас нет прав на удаление этого канала.');
      else if (err.status === 404) alert('Канал не найден.');
      else alert(`Ошибка при удалении канала: ${err.error || 'Неизвестная ошибка'}`);
    }
  });

  const handleAddManualVideo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!manualYoutubeUrl) return;
    try {
      const res = await fetch('/api/videos/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ url: manualYoutubeUrl })
      });
      if (res.ok) {
        setManualYoutubeUrl('');
        queryClient.invalidateQueries({ queryKey: ['videos'] });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleClipPublic = async (id: string, isPublic: boolean) => {
    // Optimistic update
    const previousClips = [...data.clips];
    data.setClips(prev => prev.map(c => c.id === id ? { ...c, is_public: isPublic } : c));

    try {
      const res = await fetch(`/api/clips/${id}/toggle-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ is_public: isPublic })
      });
      if (!res.ok) {
        data.setClips(previousClips);
        const err = await res.json();
        alert(err.error || "Ошибка при изменении приватности");
      } else {
        queryClient.invalidateQueries({ queryKey: ['clips'] });
      }
    } catch (err) {
      console.error(err);
      data.setClips(previousClips);
    }
  };

  return useMemo(() => ({
    authToken,
    setAuthToken: handleLogin,
    currentUser,
    activeTab,
    setActiveTab,
    isSidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    ...data,
    updateData: () => {
      queryClient.invalidateQueries();
      verifyAuth();
    },
    handleLogout,
    addPlaque: async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      await addPlaqueMutation.mutateAsync(new FormData(e.currentTarget));
      (e.target as HTMLFormElement).reset();
    },
    deletePlaque: async (id: string) => {
      if (confirm('Удалить эту плашку?')) {
        await deletePlaqueMutation.mutateAsync(id);
      }
    },
    handleEvaluateVideo: (id: string) => videoActionMutation.mutate({ id, action: 'evaluate', body: { targetAudience: data.targetAudience } }),
    handleApproveVideo: (id: string, targetLanguage?: string) => videoActionMutation.mutate({ id, action: 'approve', body: { target_language: targetLanguage } }),
    handleCompleteVideo: (id: string) => videoActionMutation.mutate({ id, action: 'complete' }),
    handleDeleteVideo: (id: string) => {
      if (confirm('Удалить это видео из мониторинга?')) deleteVideoMutation.mutate(id);
    },
    handleAddManualVideo,
    handleAddChannel: (url: string, interval: string, scrapeDays: number) => channelMutation.mutateAsync({ url, interval, scrapeDays }),
    handleDeleteChannel: (id: string) => deleteChannelMutation.mutate(id),
    handleSyncChannel: async (id: string) => {
      try {
        const res = await fetch(`/api/channels/${id}/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['channels'] });
          queryClient.invalidateQueries({ queryKey: ['videos'] });
          return true;
        }
      } catch (err) { console.error(err); }
      return false;
    },
    handleToggleChannelPublic: async (id: string, isPublic: boolean) => {
      const res = await fetch(`/api/channels/${id}/toggle-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ is_public: isPublic })
      });
      if (res.ok) queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
    handleToggleClipPublic,
    handleToggleFolderPublic: async (videoId: string, isPublic: boolean) => {
      const res = await fetch(`/api/videos/${videoId}/toggle-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ isPublic: isPublic })
      });
      if (res.ok) queryClient.invalidateQueries({ queryKey: ['clips'] });
    },
    manualYoutubeUrl,
    setManualYoutubeUrl,
    processingId
  }), [authToken, handleLogin, currentUser, activeTab, isSidebarOpen, data, handleLogout, addPlaqueMutation, deletePlaqueMutation, videoActionMutation, deleteVideoMutation, channelMutation, deleteChannelMutation, queryClient, manualYoutubeUrl, processingId, verifyAuth]);
}
