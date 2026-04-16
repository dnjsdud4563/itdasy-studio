import { api } from './client';
import type { GalleryItem } from './types';

export const gallery = {
  async list(params?: { limit?: number; cursor?: string }): Promise<{ items: GalleryItem[]; nextCursor: string | null }> {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.cursor) q.set('cursor', params.cursor);
    const qs = q.toString();
    return api(`/v1/gallery${qs ? `?${qs}` : ''}`);
  },

  async delete(id: string): Promise<void> {
    await api(`/v1/gallery/${id}`, { method: 'DELETE' });
  },
};
