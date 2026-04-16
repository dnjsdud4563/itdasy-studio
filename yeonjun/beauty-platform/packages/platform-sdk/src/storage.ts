import { api } from './client';

type Purpose = 'selfie' | 'reference' | 'avatar';
type ContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export const storage = {
  async upload(opts: { fileUri: string; purpose: Purpose; contentType?: ContentType }): Promise<{ url: string; objectKey: string }> {
    const contentType = opts.contentType ?? 'image/jpeg';
    const { uploadUrl, objectKey } = await api<{ uploadUrl: string; objectKey: string }>('/v1/storage/presign', {
      method: 'POST',
      body: JSON.stringify({ purpose: opts.purpose, contentType }),
    });

    const res = await fetch(opts.fileUri);
    const blob = await res.blob();
    const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
    if (!put.ok) throw new Error(`R2 upload failed: ${put.status}`);

    return { url: uploadUrl.split('?')[0], objectKey };
  },
};
