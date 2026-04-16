import { api } from './client';

type ReportReason = 'spam' | 'harassment' | 'sexual' | 'illegal' | 'other';

export const community = {
  async checkEula(): Promise<{ consented: boolean; version: string | null }> {
    return api('/v1/community/eula-status');
  },

  async acceptEula(): Promise<void> {
    await api('/v1/community/eula-consent', { method: 'POST' });
  },

  async createPost(opts: { contentType: string; body?: string; imageUrl?: string }) {
    return api('/v1/community/posts', { method: 'POST', body: JSON.stringify(opts) });
  },

  async getFeed(params?: { limit?: number; cursor?: string }) {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.cursor) q.set('cursor', params.cursor);
    const qs = q.toString();
    return api(`/v1/community/feed${qs ? `?${qs}` : ''}`);
  },

  async report(opts: { targetType: 'post' | 'comment' | 'user'; targetId: string; reason: ReportReason; detail?: string }) {
    return api('/v1/community/reports', { method: 'POST', body: JSON.stringify(opts) });
  },

  async blockUser(userId: string): Promise<void> {
    await api(`/v1/community/block/${userId}`, { method: 'POST' });
  },

  async unblockUser(userId: string): Promise<void> {
    await api(`/v1/community/block/${userId}`, { method: 'DELETE' });
  },
};
