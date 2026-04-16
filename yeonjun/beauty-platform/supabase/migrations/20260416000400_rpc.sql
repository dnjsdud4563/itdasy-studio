-- 원자적 크레딧 차감 RPC
create or replace function public.decrement_credit(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_left integer;
begin
  select plan, credits_remaining into v_plan, v_left
  from public.profiles where id = p_user for update;

  if v_plan in ('premium_monthly','premium_yearly') then
    return -1; -- 무제한
  end if;

  if v_left <= 0 then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  update public.profiles set credits_remaining = credits_remaining - 1 where id = p_user;
  return v_left - 1;
end;
$$;

revoke all on function public.decrement_credit(uuid) from public;
grant execute on function public.decrement_credit(uuid) to service_role;

-- reconcile 크론: generated_images 레코드 없는 R2 객체는 Edge Function에서 정리
-- (SQL만으로는 R2 접근 불가 → Edge Function이 매일 실행하며 DB와 diff)
