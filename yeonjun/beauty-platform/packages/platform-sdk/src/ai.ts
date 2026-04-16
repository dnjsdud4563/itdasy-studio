import { api } from './client';
import type { GenerateImageOptions, GenerateImageResult } from './types';

export const ai = {
  async generateImage(opts: GenerateImageOptions): Promise<GenerateImageResult> {
    return api<GenerateImageResult>('/v1/ai/generate-image', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  },
};
