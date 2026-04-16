// 통합 스토리지 레이어: R2 우선, Supabase Storage 폴백
import { putObject as r2Put, deleteObject as r2Delete, presignUpload as r2Presign } from './r2.js';
import { config } from '../config.js';

export const AI_BUCKET = 'beauty-ai-generated';
export const UPLOADS_BUCKET = 'beauty-user-uploads';

export async function ensureBuckets() {
  // R2 버킷은 대시보드에서 이미 생성됨 — no-op
}

export async function uploadToStorage(bucket: string, path: string, body: Buffer, contentType: string): Promise<string> {
  return r2Put(bucket, path, body, contentType);
}

export async function deleteFromStorage(bucket: string, paths: string[]) {
  return r2Delete(bucket, paths);
}

export async function createSignedUploadUrl(bucket: string, path: string): Promise<{ signedUrl: string; path: string }> {
  const signedUrl = await r2Presign(bucket, path, 'application/octet-stream');
  return { signedUrl, path };
}
