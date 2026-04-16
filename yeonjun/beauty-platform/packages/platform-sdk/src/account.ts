import { api } from './client';

export const account = {
  async exportData(): Promise<{ jobId: string }> {
    return api('/v1/account/export', { method: 'POST' });
  },
  async deleteAccount(): Promise<{ purgeAfter: string }> {
    return api('/v1/account', { method: 'DELETE' });
  },
};

export const push = {
  async register(token: string, platform: 'ios' | 'android') {
    await api('/v1/push/register', { method: 'POST', body: JSON.stringify({ platform, token }) });
  },
};
