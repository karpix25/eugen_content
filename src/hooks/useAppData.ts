import { useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Channel, VideoData, Clip, Publication, User, AdPlaque } from '../types';

export function useAppData(authToken: string | null, currentUser: User | null, onUnauthorized: () => void) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [totalClips, setTotalClips] = useState(0);
  const [clipsOffset, setClipsOffset] = useState(0);
  const [plaques, setPlaques] = useState<AdPlaque[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetAudience, setTargetAudience] = useState('Предприниматели, интересующиеся ИИ и автоматизацией');

  const fetchVideos = useCallback(async () => {
    if (!authToken) return;
    try {
      const data = await api.videos.list();
      setVideos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  }, [authToken]);

  const fetchData = useCallback(async () => {
    if (!authToken) return;
    try {
      const results = await Promise.allSettled([
        api.channels.list(),
        api.videos.list(),
        api.clips.list(20, 0), // Explicitly fetch first page
        api.plaques.list(currentUser?.telegram_id),
        api.users.list(),
        currentUser?.is_admin ? api.admin.getStats() : Promise.resolve([])
      ]);

      const [chRes, vidRes, clipRes, adRes, userRes] = results;

      if (chRes.status === 'fulfilled') {
        const data = chRes.value;
        if (data && (data as any).error === 'Unauthorized') {
          onUnauthorized();
          return;
        }
        setChannels(Array.isArray(data) ? data : []);
      }

      if (vidRes.status === 'fulfilled') {
        const data = vidRes.value;
        setVideos(Array.isArray(data) ? data : []);
      }

      if (clipRes.status === 'fulfilled') {
        const data = clipRes.value as any;
        if (data && data.items) {
          setClips(data.items);
          setTotalClips(data.total || 0);
          setClipsOffset(data.items.length);
        } else {
          setClips(Array.isArray(data) ? data : []);
          setTotalClips(Array.isArray(data) ? data.length : 0);
        }
      }

      if (adRes.status === 'fulfilled') {
        const data = adRes.value;
        setPlaques(Array.isArray(data) ? data : []);
      }

      if (userRes.status === 'fulfilled') {
        const data = userRes.value;
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
    }
  }, [authToken, currentUser, onUnauthorized]);

  useEffect(() => {
    if (authToken) {
      fetchData();
    }
  }, [authToken, fetchData]);

  // Polling for AI evaluation - ONLY updates videos to prevent clips list jumping
  useEffect(() => {
    if (!authToken) return;
    const hasPending = videos.some(v => v.status === 'pending' && !v.ai_evaluation);
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchVideos();
    }, 5000);

    return () => clearInterval(interval);
  }, [videos, authToken, fetchVideos]);

  const loadMoreClips = useCallback(async () => {
    if (loading || clips.length >= totalClips) return;
    setLoading(true);
    try {
      const data = await api.clips.list(20, clips.length);
      if (data && data.items) {
        setClips(prev => [...prev, ...data.items]);
        setClipsOffset(prev => prev + data.items.length);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, clips.length, totalClips]);

  return useMemo(() => ({
    channels,
    setChannels,
    videos,
    setVideos,
    clips,
    setClips,
    totalClips,
    loadMoreClips,
    plaques,
    setPlaques,
    users,
    setUsers,
    loading,
    setLoading,
    targetAudience,
    setTargetAudience,
    fetchData
  }), [channels, videos, clips, totalClips, loadMoreClips, plaques, users, loading, targetAudience, fetchData]);
}
