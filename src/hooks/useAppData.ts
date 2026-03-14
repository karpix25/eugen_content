import { useState, useCallback, useEffect } from 'react';
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
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetAudience, setTargetAudience] = useState('Предприниматели, интересующиеся ИИ и автоматизацией');

  const fetchData = useCallback(async () => {
    if (!authToken) return;
    try {
      const results = await Promise.allSettled([
        api.channels.list(),
        api.videos.list(),
        api.clips.list(),
        api.plaques.list(currentUser?.telegram_id),
        api.users.list(),
        currentUser?.is_admin ? api.admin.getPublications() : Promise.resolve([])
      ]);

      const [chRes, vidRes, clipRes, adRes, userRes, pubRes] = results;

      if (chRes.status === 'fulfilled') {
        const data = chRes.value;
        console.log('[fetchData] channels:', data);
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

      if (pubRes.status === 'fulfilled') {
        const data = pubRes.value;
        setPublications(Array.isArray(data) ? data : []);
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

  // Polling for AI evaluation
  useEffect(() => {
    if (!authToken) return;
    const hasPending = videos.some(v => v.status === 'pending' && !v.ai_evaluation);
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [videos, authToken, fetchData]);

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

  return {
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
    publications,
    setPublications,
    loading,
    setLoading,
    targetAudience,
    setTargetAudience,
    fetchData
  };
}
