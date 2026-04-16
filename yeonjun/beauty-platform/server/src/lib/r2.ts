import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
});

export async function putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return `${config.R2_PUBLIC_BASE_URL}/${bucket}/${key}`;
}

export async function deleteObject(bucket: string, keys: string[]) {
  if (keys.length === 0) return;
  if (keys.length === 1) {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: keys[0] }));
  } else {
    await r2.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
  }
}

export async function presignUpload(bucket: string, key: string, contentType: string, expiresIn = 300): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export { ListObjectsV2Command, DeleteObjectsCommand };
