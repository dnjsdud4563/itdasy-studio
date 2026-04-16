-- Meta/Instagram 연동 테이블
create table if not exists public.meta_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ig_user_id text not null,
  ig_username text,
  access_token_cipher text not null,  -- AES-256 GCM 암호화
  token_expires_at timestamptz,
  scopes text,
  created_at timestamptz not null default now()
);

alter table public.meta_connections enable row level security;

create policy meta_select_own on public.meta_connections
  for select using (auth.uid() = user_id);
create policy meta_delete_own on public.meta_connections
  for delete using (auth.uid() = user_id);
