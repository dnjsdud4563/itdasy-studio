-- Row Level Security: 모든 사용자 테이블에 "본인 row만" 정책 적용
-- service_role은 RLS bypass (서버 전용 작업용)

alter table public.profiles           enable row level security;
alter table public.entitlements       enable row level security;
alter table public.generated_images   enable row level security;
alter table public.push_tokens        enable row level security;
alter table public.account_deletion_requests enable row level security;
-- access_logs, webhook_events: 서버만 접근. RLS 활성 + 정책 없음 = 클라이언트 0건.
alter table public.access_logs        enable row level security;
alter table public.webhook_events     enable row level security;

-- profiles
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- insert는 handle_new_user 트리거(security definer)에서만.

-- entitlements (사용자는 읽기만, 쓰기는 서버)
create policy entitlements_select_own on public.entitlements
  for select using (auth.uid() = user_id);

-- generated_images
create policy gen_images_select_own on public.generated_images
  for select using (auth.uid() = user_id);
create policy gen_images_insert_own on public.generated_images
  for insert with check (auth.uid() = user_id);
create policy gen_images_delete_own on public.generated_images
  for delete using (auth.uid() = user_id);

-- push_tokens
create policy push_tokens_all_own on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- account_deletion_requests
create policy deletion_insert_own on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
create policy deletion_select_own on public.account_deletion_requests
  for select using (auth.uid() = user_id);
