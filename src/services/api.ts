import { Channel, VideoData, Clip, Publication, User, AdPlaque } from '../types';

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    console.error(`[API Error] ${res.url} returned ${res.status}: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      return { error: text || res.statusText, status: res.status };
    }
  }
  try {
    return await res.json();
  } catch (err) {
    console.error(`[API Error] Failed to parse JSON from ${res.url}`, err);
    return { error: 'Invalid JSON response' };
  }
}

export const api = {
  async getConfig() {
    const res = await fetch('/api/config');
    return handleResponse(res);
  },

  auth: {
    async init() {
      const res = await fetch('/api/auth/init');
      return handleResponse(res);
    },
    async check(sessionId: string) {
      const res = await fetch(`/api/auth/check/${sessionId}`);
      return handleResponse(res);
    },
    async verify() {
      const res = await fetch('/api/auth/check', { headers: getHeaders() });
      return handleResponse(res);
    }
  },

  channels: {
    async list(): Promise<Channel[]> {
      const res = await fetch('/api/channels', { headers: getHeaders() });
      return handleResponse(res);
    },
    async create(url: string, interval: string, scrapeDays: number): Promise<Channel> {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ url, interval, scrapeDays })
      });
      return handleResponse(res);
    },
    async delete(id: string) {
      const res = await fetch(`/api/channels/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getHeaders() });
      return handleResponse(res);
    }
  },

  videos: {
    async list(): Promise<VideoData[]> {
      const res = await fetch('/api/videos', { headers: getHeaders() });
      return handleResponse(res);
    },
    async evaluate(id: string, targetAudience: string) {
      const res = await fetch(`/api/videos/${id}/evaluate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetAudience })
      });
      return handleResponse(res);
    },
    async approve(id: string, targetAudience: string) {
      const res = await fetch(`/api/videos/${id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetAudience })
      });
      return handleResponse(res);
    },
    async complete(id: string) {
      const res = await fetch(`/api/videos/${id}/complete`, { method: 'POST', headers: getHeaders() });
      return handleResponse(res);
    },
    async triggerMonitor() {
      const res = await fetch('/api/monitor', { method: 'POST', headers: getHeaders() });
      return handleResponse(res);
    }
  },

  clips: {
    async list(limit: number = 20, offset: number = 0): Promise<{ items: Clip[], total: number }> {
      const res = await fetch(`/api/clips?limit=${limit}&offset=${offset}`, { headers: getHeaders() });
      return handleResponse(res);
    },
    async applyPlaque(clipId: string, plaqueId: string | null) {
      const res = await fetch(`/api/clips/${clipId}/apply-plaque`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ad_plaque_id: plaqueId })
      });
      return handleResponse(res);
    }
  },

  users: {
    async list(): Promise<User[]> {
      const res = await fetch('/api/users', { headers: getHeaders() });
      return handleResponse(res);
    },
    async authorize(id: string, isAuthorized: boolean) {
      const res = await fetch(`/api/users/${id}/authorize`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ isAuthorized })
      });
      return handleResponse(res);
    },
    async saveSettings(settings: any) {
      const res = await fetch('/api/users/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(settings)
      });
      return handleResponse(res);
    }
  },

  plaques: {
    async list(userId?: string): Promise<AdPlaque[]> {
      const url = `/api/ad-plaques${userId ? `?user_id=${userId}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      return handleResponse(res);
    },
    async delete(id: string) {
      const res = await fetch(`/api/ad-plaques/${id}`, { method: 'DELETE', headers: getHeaders() });
      return handleResponse(res);
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
      return handleResponse(res);
    }
  },

  admin: {
    async getStats() {
      const res = await fetch('/api/admin/stats', { headers: getHeaders() });
      return handleResponse(res);
    }
  }
};
