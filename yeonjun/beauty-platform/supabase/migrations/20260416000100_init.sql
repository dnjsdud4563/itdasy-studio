-- Beauty Platform initial schema
-- gen_random_uuid() is built-in on Postgres 14+ (Supabase default)

-- ===========================
-- profiles
-- ===========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','premium_monthly','premium_yearly')),
  credits_remaining integer not null default 3,
  -- PII는 애플리케이션 계층에서 AES-256 GCM 암호화된 payload (base64) 저장
  phone_ciphertext text,
  real_name_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_plan on public.profiles(plan);

-- ===========================
-- entitlements (결제 상태 단일 진실원)
-- ===========================
create table if not exists public.entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free',
  source text not null default 'none' check (source in ('revenuecat','portone','none')),
  renew_at timestamptz,
  original_transaction_id text,
  updated_at timestamptz not null default now()
);

-- ===========================
-- webhook_events (idempotency)
-- ===========================
create table if not exists public.webhook_events (
  id text primary key,                 -- provider event id
  provider text not null,              -- 'revenuecat' | 'portone'
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

-- ===========================
-- generated_images (AI 생성 갤러리)
-- ===========================
create table if not exists public.generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  style text not null default 'natural',
  image_url text not null,             -- Cloudflare R2 public URL
  thumbnail_url text,
  object_key text not null,            -- R2 객체 키 (삭제 시 필요)
  generation_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_gen_images_user_created on public.generated_images(user_id, created_at desc);

-- ===========================
-- access_logs (통신비밀보호법: 90일 보관 후 파기)
-- ===========================
create table if not exists public.access_logs (
  id bigserial primary key,
  user_id uuid,
  ip_hash text,                        -- IP는 해시만 저장
  user_agent text,
  path text not null,
  method text not null,
  status integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_logs_created on public.access_logs(created_at);

-- ===========================
-- push_tokens
-- ===========================
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  token text not null,
  created_at timestamptz not null default now(),
  unique(user_id, token)
);

-- ===========================
-- account_deletion_requests (30일 유예)
-- ===========================
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '30 days')
);

-- ===========================
-- updated_at 자동 갱신 트리거
-- ===========================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_entitlements_touch on public.entitlements;
create trigger trg_entitlements_touch before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- ===========================
-- 신규 가입 시 profile / entitlement 자동 생성
-- ===========================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', '뷰티러버' || substr(new.id::text,1,4)))
  on conflict (id) do nothing;

  insert into public.entitlements (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
