create table public.voice_session_extensions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_sessions (id) on delete cascade,
  request_id uuid not null unique,
  reservation_id uuid not null unique references public.credit_reservations (id) on delete restrict,
  previous_ends_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at = previous_ends_at + interval '5 minutes')
);

alter table public.voice_session_extensions enable row level security;
revoke all on public.voice_session_extensions from public, anon, authenticated;
grant select, insert on public.voice_session_extensions to service_role;

create or replace function public.extend_voice_session(p_user_id uuid, p_session_id uuid, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  wallet public.credit_wallets%rowtype;
  voice_session public.voice_sessions%rowtype;
  extension public.voice_session_extensions%rowtype;
  reservation public.credit_reservations%rowtype;
  free_spent integer;
  subscription_spent integer;
  purchased_spent integer;
  next_ends_at timestamptz;
begin
  if p_request_id is null or p_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'valid request ID required' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id, 0));

  select * into extension from public.voice_session_extensions where request_id = p_request_id::uuid;
  if found then
    select * into voice_session from public.voice_sessions where id = extension.session_id and user_id = p_user_id;
    if not found or voice_session.id <> p_session_id then raise exception 'request ID is already in use' using errcode = '23505'; end if;
    select * into wallet from public.credit_wallets where user_id = p_user_id;
    return jsonb_build_object('sessionId', voice_session.id, 'endsAt', extract(epoch from voice_session.ends_at) * 1000, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
  end if;

  select * into voice_session from public.voice_sessions where id = p_session_id and user_id = p_user_id for update;
  if not found or voice_session.status <> 'issued' or voice_session.ends_at < clock_timestamp() - interval '30 seconds' or voice_session.ends_at > clock_timestamp() + interval '1 minute' then
    raise exception 'voice session cannot be extended' using errcode = 'P0001';
  end if;
  select * into wallet from public.credit_wallets where user_id = p_user_id for update;
  if not found then raise exception 'credit wallet not found' using errcode = 'P0002'; end if;
  if wallet.free_balance::bigint + wallet.subscription_balance + wallet.purchased_balance < 10 then raise exception 'insufficient credits' using errcode = 'P0001'; end if;

  free_spent := least(wallet.free_balance, 10);
  subscription_spent := least(wallet.subscription_balance, 10 - free_spent);
  purchased_spent := 10 - free_spent - subscription_spent;
  update public.credit_wallets set free_balance = free_balance - free_spent, subscription_balance = subscription_balance - subscription_spent, purchased_balance = purchased_balance - purchased_spent where user_id = p_user_id returning * into wallet;

  insert into public.credit_reservations (user_id, feature, amount, status, request_id, bucket_breakdown, subscription_period_key, expires_at)
  values (p_user_id, 'voice_session', 10, 'spent', p_request_id, jsonb_build_object('free', free_spent, 'subscription', subscription_spent, 'purchased', purchased_spent), wallet.subscription_period_key, clock_timestamp() + interval '10 minutes') returning * into reservation;

  insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
  select p_user_id, -entry.amount, entry.bucket, 'spend', 'voice_session', reservation.id::text, 'voice-extension:' || p_request_id || ':' || entry.bucket, jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id, 'sessionId', p_session_id)
  from (values ('free', free_spent), ('subscription', subscription_spent), ('purchased', purchased_spent)) entry(bucket, amount) where entry.amount > 0;

  next_ends_at := voice_session.ends_at + interval '5 minutes';
  update public.voice_sessions set ends_at = next_ends_at where id = p_session_id returning * into voice_session;
  insert into public.voice_session_extensions (session_id, request_id, reservation_id, previous_ends_at, ends_at) values (p_session_id, p_request_id::uuid, reservation.id, next_ends_at - interval '5 minutes', next_ends_at);

  return jsonb_build_object('sessionId', voice_session.id, 'endsAt', extract(epoch from next_ends_at) * 1000, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
end; $$;

revoke all on function public.extend_voice_session(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.extend_voice_session(uuid, uuid, text) to service_role;
