-- 통신비밀보호법 자동 파기: access_logs 90일 초과 row 삭제
-- 계정 삭제 유예 경과분 purge

create extension if not exists pg_cron;

-- 90일 초과 접근 로그 삭제 (매일 KST 03:00 = UTC 18:00 전일)
select cron.schedule(
  'purge-access-logs-90d',
  '0 18 * * *',
  $$delete from public.access_logs where created_at < now() - interval '90 days'$$
);

-- 30일 유예 경과 계정 완전 파기 (매일 KST 04:00 = UTC 19:00 전일)
select cron.schedule(
  'purge-deleted-accounts',
  '0 19 * * *',
  $$
    delete from auth.users
    where id in (
      select user_id from public.account_deletion_requests
      where purge_after < now()
    )
  $$
);
