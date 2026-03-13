import { Channel, VideoData, Clip, Publication, User, AdPlaque } from '../types';

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  async getConfig() {
    const res = await fetch('/api/config');
    return res.json();
  },

  auth: {
    async init() {
      const res = await fetch('/api/auth/init');
      return res.json();
    },
    async check(sessionId: string) {
      const res = await fetch(`/api/auth/check/${sessionId}`);
      return res.json();
    },
    async verify() {
      const res = await fetch('/api/auth/check', { headers: getHeaders() });
      return res.json();
    }
  },

  channels: {
    async list(): Promise<Channel[]> {
      const res = await fetch('/api/channels', { headers: getHeaders() });
      return res.json();
    },
    async create(url: string, interval: string, scrapeDays: number): Promise<Channel> {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ url, interval, scrapeDays })
      });
      return res.json();
    },
    async delete(id: string) {
      await fetch(`/api/channels/${id}`, { method: 'DELETE', headers: getHeaders() });
    }
  },

  videos: {
    async list(): Promise<VideoData[]> {
      const res = await fetch('/api/videos', { headers: getHeaders() });
      return res.json();
    },
    async evaluate(id: string, targetAudience: string) {
      const res = await fetch(`/api/videos/${id}/evaluate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetAudience })
      });
      return res.json();
    },
    async approve(id: string, targetAudience: string) {
      const res = await fetch(`/api/videos/${id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetAudience })
      });
      return res.json();
    },
    async complete(id: string) {
      await fetch(`/api/videos/${id}/complete`, { method: 'POST', headers: getHeaders() });
    },
    async triggerMonitor() {
      await fetch('/api/monitor', { method: 'POST', headers: getHeaders() });
    }
  },

  clips: {
    async list(): Promise<Clip[]> {
      const res = await fetch('/api/clips', { headers: getHeaders() });
      return res.json();
    },
    async applyPlaque(clipId: string, plaqueId: string | null) {
      const res = await fetch(`/api/clips/${clipId}/apply-plaque`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ad_plaque_id: plaqueId })
      });
      return res.json();
    }
  },

  users: {
    async list(): Promise<User[]> {
      const res = await fetch('/api/users', { headers: getHeaders() });
      return res.json();
    },
    async authorize(id: string, isAuthorized: boolean) {
      await fetch(`/api/users/${id}/authorize`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ isAuthorized })
      });
    },
    async saveSettings(settings: any) {
      const res = await fetch('/api/users/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings)
      });
      return res.json();
    }
  },

  plaques: {
    async list(userId?: string): Promise<AdPlaque[]> {
      const url = `/api/ad-plaques${userId ? `?user_id=${userId}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      return res.json();
    },
    async delete(id: string) {
      await fetch(`/api/ad-plaques/${id}`, { method: 'DELETE', headers: getHeaders() });
    },
    async create(formData: FormData) {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/ad-plaques', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });
      return res.json();
    }
  },

  admin: {
    async getPublications(): Promise<Publication[]> {
      const res = await fetch('/api/admin/publications', { headers: getHeaders() });
      return res.json();
    },
    async getStats() {
      const res = await fetch('/api/admin/stats', { headers: getHeaders() });
      return res.json();
    }
  }
};
