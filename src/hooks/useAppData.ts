import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { User } from '../types';

export function useAppData(authToken: string | null, currentUser: User | null, onUnauthorized: () => void) {
  const queryClient = useQueryClient();
  const [targetAudience, setTargetAudience] = useState('Предприниматели, интересующиеся ИИ и автоматизацией');
  const [loadingMore, setLoadingMore] = useState(false);

  // Channels Query
  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const data = await api.channels.list();
      if (data && (data as any).error === 'Unauthorized') {
        onUnauthorized();
        throw new Error('Unauthorized');
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!authToken,
    refetchInterval: (query) => {
      const hasSyncing = query.state.data?.some((c: any) => c.sync_status === 'syncing');
      return hasSyncing ? 5000 : false;
    }
  });

  // Videos Query
  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const data = await api.videos.list();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!authToken,
    refetchInterval: (query) => {
      const hasActiveStates = query.state.data?.some((v: any) => 
        (v.status === 'pending' && !v.ai_evaluation) || 
        v.status === 'approved' || 
        v.status === 'sent_to_vizard' ||
        v.status === 'vizard_creating' ||
        v.status === 'vizard_processing' ||
        v.status === 'vizard_fallback_running'
      );
      return hasActiveStates ? 5000 : false;
    }
  });

  // Clips Query - Initial Page
  const { data: clipsData } = useQuery({
    queryKey: ['clips', 0], // Key for the first page
    queryFn: () => api.clips.list(20, 0),
    enabled: !!authToken,
  });

  // Manual clips management for pagination
  const [clips, setClips] = useState<any[]>([]);
  const [totalClips, setTotalClips] = useState(0);

  // Sync clips query with local state for pagination
  useEffect(() => {
    if (clipsData) {
      if ((clipsData as any).items) {
        setClips((clipsData as any).items);
        setTotalClips((clipsData as any).total || 0);
      } else if (Array.isArray(clipsData)) {
        setClips(clipsData);
        setTotalClips(clipsData.length);
      }
    }
  }, [clipsData]);

  // Plaques Query
  const { data: plaques = [] } = useQuery({
    queryKey: ['plaques', currentUser?.telegram_id],
    queryFn: () => api.plaques.list(currentUser?.telegram_id),
    enabled: !!authToken && !!currentUser,
  });

  // Users Query (Admin only)
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: !!authToken && !!currentUser?.is_admin,
  });

  const fetchData = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const loadMoreClips = useCallback(async () => {
    if (loadingMore || clips.length >= totalClips) return;
    setLoadingMore(true);
    try {
      const data = await api.clips.list(20, clips.length);
      if (data && data.items) {
        setClips(prev => [...prev, ...data.items]);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, clips.length, totalClips]);

  return useMemo(() => ({
    channels,
    videos,
    clips,
    setClips,
    totalClips,
    loadMoreClips,
    plaques,
    users,
    loading: loadingMore,
    targetAudience,
    setTargetAudience,
    fetchData
  }), [channels, videos, clips, totalClips, loadMoreClips, plaques, users, loadingMore, targetAudience, fetchData]);
}
