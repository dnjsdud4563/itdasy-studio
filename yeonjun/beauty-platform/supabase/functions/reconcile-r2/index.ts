// Supabase Edge Function — daily reconcile
// R2 ListObjectsV2 → generated_images diff → 고아 객체 삭제
// 배포: supabase functions deploy reconcile-r2
// 스케줄: supabase functions schedule create reconcile-r2 --cron "0 20 * * *"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';

const env = (k: string) => Deno.env.get(k)!;

Deno.serve(async () => {
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
  });
  const Bucket = env('R2_BUCKET_AI');

  const { data: rows } = await sb.from('generated_images').select('object_key').limit(100000);
  const known = new Set((rows ?? []).map((r: { object_key: string }) => r.object_key));

  let ContinuationToken: string | undefined;
  let orphanCount = 0;
  const orphans: { Key: string }[] = [];

  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken, Prefix: 'gen/' }));
    for (const obj of page.Contents ?? []) {
      if (!obj.Key) continue;
      // 2시간 이내 업로드는 race 조건 가능성 → skip
      if (obj.LastModified && Date.now() - obj.LastModified.getTime() < 2 * 3600 * 1000) continue;
      if (!known.has(obj.Key)) {
        orphans.push({ Key: obj.Key });
        orphanCount++;
        if (orphans.length === 1000) {
          await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: orphans.splice(0) } }));
        }
      }
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);

  if (orphans.length) {
    await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: orphans } }));
  }

  return new Response(JSON.stringify({ ok: true, knownCount: known.size, orphansDeleted: orphanCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
