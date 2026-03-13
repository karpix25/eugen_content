import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { Channel, VideoData, Clip, Publication, User, AdPlaque } from '../types';

export function useAppData(authToken: string | null, currentUser: User | null, onUnauthorized: () => void) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [plaques, setPlaques] = useState<AdPlaque[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetAudience, setTargetAudience] = useState('Предприниматели, интересующиеся ИИ и автоматизацией');

  const fetchData = useCallback(async () => {
    if (!authToken) return;
    try {
      const [chData, vidData, clipData, adData, userData, pubData] = await Promise.all([
        api.channels.list(),
        api.videos.list(),
        api.clips.list(),
        api.plaques.list(currentUser?.telegram_id),
        api.users.list(),
        currentUser?.is_admin ? api.admin.getPublications() : Promise.resolve([])
      ]);

      const allData = [chData, vidData, clipData, adData, userData, pubData];
      if (allData.some(d => d && (d.error === 'Unauthorized' || d === 401))) {
        onUnauthorized();
        return;
      }

      setChannels(Array.isArray(chData) ? chData : []);
      setVideos(Array.isArray(vidData) ? vidData : []);
      setClips(Array.isArray(clipData) ? clipData : []);
      setPlaques(Array.isArray(adData) ? adData : []);
      setUsers(Array.isArray(userData) ? userData : []);
      setPublications(Array.isArray(pubData) ? pubData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
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

  return {
    channels,
    setChannels,
    videos,
    setVideos,
    clips,
    setClips,
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
