// Supabase Edge Function — 사용자 데이터 내보내기 (PIPA 의무)
// 호출: POST /functions/v1/export-user-data  body: { userId }
// 서비스 롤 호출만 허용 (서버에서만 프록시)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';
import { GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';

const env = (k: string) => Deno.env.get(k)!;

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('unauthorized', { status: 401 });
  }
  const { userId } = await req.json();
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  const [{ data: profile }, { data: images }, { data: entitlements }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).single(),
    sb.from('generated_images').select('*').eq('user_id', userId),
    sb.from('entitlements').select('*').eq('user_id', userId).single(),
  ]);

  const bundle = JSON.stringify({ profile, images, entitlements, exportedAt: new Date().toISOString() }, null, 2);

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
  });
  const key = `exports/${userId}/${Date.now()}.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env('R2_BUCKET_UPLOADS'),
      Key: key,
      Body: bundle,
      ContentType: 'application/json',
    }),
  );
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: env('R2_BUCKET_UPLOADS'), Key: key }), {
    expiresIn: 24 * 3600,
  });

  return new Response(JSON.stringify({ url }), { headers: { 'Content-Type': 'application/json' } });
});
