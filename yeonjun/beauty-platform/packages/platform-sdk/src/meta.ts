import { api } from './client';

type IGProfile = {
  id: string;
  username: string;
  account_type: string;
  media_count: number;
  profile_picture_url?: string;
};

type IGMedia = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
};

export const meta = {
  async getAuthUrl(): Promise<{ url: string }> {
    return api('/v1/meta/auth');
  },

  async getProfile(): Promise<IGProfile> {
    return api('/v1/meta/profile');
  },

  async getFeed(params?: { limit?: number; after?: string }): Promise<{ data: IGMedia[]; nextCursor?: string }> {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.after) q.set('after', params.after);
    const qs = q.toString();
    return api(`/v1/meta/feed${qs ? `?${qs}` : ''}`);
  },

  async disconnect(): Promise<void> {
    await api('/v1/meta/disconnect', { method: 'DELETE' });
  },

  async isConnected(): Promise<boolean> {
    try {
      await this.getProfile();
      return true;
    } catch {
      return false;
    }
  },
};
