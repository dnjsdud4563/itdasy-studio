import { api } from './client';

export const imageTools = {
  async removeBackground(imageUrl: string): Promise<{ imageUrl: string; objectKey: string; sizeBytes: number }> {
    return api('/v1/image/remove-bg', {
      method: 'POST',
      body: JSON.stringify({ imageUrl }),
    });
  },
};
