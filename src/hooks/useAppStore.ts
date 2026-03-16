import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useAppData } from './useAppData';

export function useAppStore() {
  const { authToken, currentUser, handleLogin, handleLogout } = useAuth();
  const data = useAppData(authToken, currentUser, handleLogout);
  const [activeTab, setActiveTab] = useState('clips');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [manualYoutubeUrl, setManualYoutubeUrl] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  // Add plaque management to the store
  const addPlaque = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/ad-plaques', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      });
      if (res.ok) {
        data.fetchData();
        (e.target as HTMLFormElement).reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deletePlaque = async (id: string) => {
    if (!confirm('Удалить эту плашку?')) return;
    try {
      const res = await fetch(`/api/ad-plaques/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) data.fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEvaluateVideo = async (id: string) => {
    setProcessingId(id);
    try {
      await fetch(`/api/videos/${id}/evaluate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}` 
        },
        body: JSON.stringify({ targetAudience: data.targetAudience })
      });
      data.fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveVideo = async (id: string, targetLanguage?: string) => {
    setProcessingId(id);
    try {
      await fetch(`/api/videos/${id}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}` 
        },
        body: JSON.stringify({ target_language: targetLanguage })
      });
      data.fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteVideo = async (id: string) => {
    setProcessingId(id);
    try {
      await fetch(`/api/videos/${id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      data.fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Удалить это видео из мониторинга?')) return;
    try {
      await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      data.fetchData();
    } catch (err) {
      console.error(err);
    }
  };

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
        data.fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChannel = async (url: string, interval: string, scrapeDays: number) => {
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          id: url,
          monitoring_interval: interval,
          scrape_days: scrapeDays
        })
      });
      if (res.ok) {
        data.fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Удалить этот канал?')) return;
    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) data.fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleChannelPublic = async (id: string, isPublic: boolean) => {
    try {
      const res = await fetch(`/api/channels/${id}/toggle-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ is_public: isPublic })
      });
      if (res.ok) data.fetchData();
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
        // Rollback on error
        data.setClips(previousClips);
        const err = await res.json();
        alert(err.error || "Ошибка при изменении приватности");
      }
    } catch (err) {
      console.error(err);
      data.setClips(previousClips);
    }
  };

  const handleToggleFolderPublic = async (videoId: string, isPublic: boolean) => {
    // Optimistic update
    const previousClips = [...data.clips];
    data.setClips(prev => prev.map(c => c.video_id === videoId ? { ...c, video_is_public: isPublic } : c));

    try {
      const res = await fetch(`/api/videos/${videoId}/toggle-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ isPublic: isPublic })
      });

      if (!res.ok) {
        // Rollback
        data.setClips(previousClips);
        const err = await res.json();
        alert(err.error || "Ошибка при изменении приватности");
      }
    } catch (err) {
      console.error(err);
      data.setClips(previousClips);
    }
  };

  return {
    authToken,
    setAuthToken: handleLogin,
    currentUser,
    activeTab,
    setActiveTab,
    isSidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    ...data,
    updateData: data.fetchData,
    handleLogout,
    addPlaque,
    deletePlaque,
    handleEvaluateVideo,
    handleApproveVideo,
    handleCompleteVideo,
    handleDeleteVideo,
    handleAddManualVideo,
    handleAddChannel,
    handleDeleteChannel,
    handleToggleChannelPublic,
    handleToggleClipPublic,
    handleToggleFolderPublic,
    manualYoutubeUrl,
    setManualYoutubeUrl,
    processingId
  };
}
