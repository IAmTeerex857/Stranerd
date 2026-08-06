create table public.api_rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

create index api_rate_limits_window_idx on public.api_rate_limits (window_started_at);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated, service_role;

create or replace function public.check_ai_rate_limits(
  p_user_key text,
  p_user_limit integer,
  p_ip_key text,
  p_ip_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz := clock_timestamp();
  user_allowed boolean;
  ip_allowed boolean;
begin
  if p_user_key is null or length(p_user_key) < 10
    or p_user_limit is null or p_user_limit < 1
    or p_ip_limit is null or p_ip_limit < 1
    or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid rate-limit parameters' using errcode = '22023';
  end if;

  insert into public.api_rate_limits as limits (key, window_started_at, request_count)
  values (p_user_key, checked_at, 1)
  on conflict (key) do update
  set window_started_at = case
        when limits.window_started_at + make_interval(secs => p_window_seconds) <= checked_at
          then checked_at
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at + make_interval(secs => p_window_seconds) <= checked_at
          then 1
        else limits.request_count + 1
      end
  returning request_count <= p_user_limit into user_allowed;

  if not user_allowed then
    return false;
  end if;

  -- Local development may not have a trusted proxy address; user limiting still applies.
  if p_ip_key is null then
    return true;
  end if;

  if length(p_ip_key) < 10 then
    raise exception 'invalid IP rate-limit key' using errcode = '22023';
  end if;

  insert into public.api_rate_limits as limits (key, window_started_at, request_count)
  values (p_ip_key, checked_at, 1)
  on conflict (key) do update
  set window_started_at = case
        when limits.window_started_at + make_interval(secs => p_window_seconds) <= checked_at
          then checked_at
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at + make_interval(secs => p_window_seconds) <= checked_at
          then 1
        else limits.request_count + 1
      end
  returning request_count <= p_ip_limit into ip_allowed;

  return ip_allowed;
end;
$$;

revoke all on function public.check_ai_rate_limits(text, integer, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_ai_rate_limits(text, integer, text, integer, integer) to service_role;

create or replace function public.reconcile_expired_ai_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_usage
  set status = 'failed',
      completed_at = coalesce(completed_at, clock_timestamp()),
      metadata = metadata || jsonb_build_object('reason', 'reservation_expired')
  where reservation_id = new.id and status = 'requested';
  return new;
end;
$$;

create trigger credit_reservation_expiry_reconciles_usage
after update of status on public.credit_reservations
for each row
when (new.status = 'expired' and old.status is distinct from new.status)
execute function public.reconcile_expired_ai_usage();

update public.ai_usage as usage
set status = 'failed',
    completed_at = coalesce(usage.completed_at, clock_timestamp()),
    metadata = usage.metadata || jsonb_build_object('reason', 'reservation_expired')
from public.credit_reservations as reservation
where usage.reservation_id = reservation.id
  and usage.status = 'requested'
  and reservation.status = 'expired';

select cron.schedule(
  'stranerd-clean-api-rate-limits',
  '17 3 * * *',
  'delete from public.api_rate_limits where window_started_at < now() - interval ''1 day'';'
);

revoke all on function public.reconcile_expired_ai_usage() from public, anon, authenticated;
