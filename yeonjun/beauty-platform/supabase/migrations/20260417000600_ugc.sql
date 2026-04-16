-- UGC 모더레이션: 게시물, 신고, 차단
-- Apple 1.2 / Google UGC 정책 필수

-- 게시물
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('text','image','tip','review')),
  body text,
  image_url text,
  object_key text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_user on public.posts(user_id, created_at desc);
create index if not exists idx_posts_created on public.posts(created_at desc);

-- 댓글
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- 신고 (게시물·댓글 단위)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','user')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','sexual','illegal','other')),
  detail text,
  status text not null default 'pending' check (status in ('pending','reviewed','resolved','dismissed')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reports_status on public.reports(status, created_at);

-- 사용자 차단
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- EULA 동의 기록
create table if not exists public.eula_consents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version text not null default '1.0',
  consented_at timestamptz not null default now()
);

-- RLS
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.eula_consents enable row level security;

-- posts: 본인 작성 + 차단 안 당한 타인 글 조회
create policy posts_select on public.posts for select using (
  not is_hidden and (
    user_id = auth.uid() or
    user_id not in (select blocked_id from public.blocks where blocker_id = auth.uid())
  )
);
create policy posts_insert_own on public.posts for insert with check (auth.uid() = user_id);
create policy posts_delete_own on public.posts for delete using (auth.uid() = user_id);

-- comments
create policy comments_select on public.comments for select using (
  not is_hidden and (
    user_id = auth.uid() or
    user_id not in (select blocked_id from public.blocks where blocker_id = auth.uid())
  )
);
create policy comments_insert_own on public.comments for insert with check (auth.uid() = user_id);
create policy comments_delete_own on public.comments for delete using (auth.uid() = user_id);

-- reports: 본인 신고만 작성/조회
create policy reports_insert_own on public.reports for insert with check (auth.uid() = reporter_id);
create policy reports_select_own on public.reports for select using (auth.uid() = reporter_id);

-- blocks: 본인만
create policy blocks_all_own on public.blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- eula
create policy eula_all_own on public.eula_consents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
