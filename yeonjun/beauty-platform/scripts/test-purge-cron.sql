-- 파기 스케줄 검증: 4개월 전 mock 로그 삽입 후 pg_cron 작업 수동 실행
-- Supabase SQL Editor에서 실행

-- 1) Mock 로그 주입 (최근 30일 내 50건, 100~120일 전 50건)
insert into public.access_logs (user_id, path, method, status, created_at)
select null, '/v1/ai/generate-image', 'POST', 200, now() - (random() * interval '30 days')
from generate_series(1, 50);

insert into public.access_logs (user_id, path, method, status, created_at)
select null, '/v1/ai/generate-image', 'POST', 200, now() - interval '100 days' - (random() * interval '20 days')
from generate_series(1, 50);

-- 2) 스케줄 수동 트리거
select cron.schedule('purge-manual-test', '* * * * *',
  $$delete from public.access_logs where created_at < now() - interval '90 days'$$);
-- (1분 기다린 후)

-- 3) 검증: 최근 30일 50건 남고, 100일 전 50건은 0이어야 함.
select
  count(*) filter (where created_at >= now() - interval '30 days') as recent_kept,
  count(*) filter (where created_at < now() - interval '90 days')  as old_purged
from public.access_logs;

-- 4) 테스트 스케줄 정리
select cron.unschedule('purge-manual-test');
