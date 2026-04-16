import { api } from './client';
import type { Profile } from './types';

export const profile = {
  async me(): Promise<Profile> {
    return api<Profile>('/v1/profile');
  },
  async update(patch: { nickname?: string; phone?: string; realName?: string }) {
    return api('/v1/profile', { method: 'PATCH', body: JSON.stringify(patch) });
  },
};
