create extension if not exists pg_cron with schema pg_catalog;

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('mentor', 'ai_quiz')),
  amount integer not null check (amount > 0),
  status text not null default 'reserved' check (status in ('reserved', 'spent', 'refunded', 'expired')),
  request_id text not null unique check (request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  bucket_breakdown jsonb not null check (jsonb_typeof(bucket_breakdown) = 'object'),
  subscription_period_key text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_reservations_user_created_idx
  on public.credit_reservations (user_id, created_at desc);

create index credit_reservations_expiry_idx
  on public.credit_reservations (expires_at)
  where status = 'reserved';

create trigger credit_reservations_set_updated_at
before update on public.credit_reservations
for each row execute function public.set_updated_at();

alter table public.credit_reservations enable row level security;

create policy credit_reservations_select_own
on public.credit_reservations
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.credit_reservations from anon, authenticated;
grant select on table public.credit_reservations to authenticated;

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_feature text,
  p_amount integer,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.credit_wallets%rowtype;
  reservation public.credit_reservations%rowtype;
  free_reserved integer;
  subscription_reserved integer;
  purchased_reserved integer;
begin
  if p_feature not in ('mentor', 'ai_quiz') then
    raise exception 'unsupported credit feature' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'credit amount must be positive' using errcode = '22023';
  end if;
  if p_request_id is null or length(p_request_id) = 0 then
    raise exception 'request ID is required' using errcode = '22023';
  end if;

  perform 1 from auth.users where id = p_user_id for key share;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select * into reservation
  from public.credit_reservations
  where request_id = p_request_id;

  if found then
    if reservation.user_id <> p_user_id
      or reservation.feature <> p_feature
      or reservation.amount <> p_amount then
      raise exception 'request ID is already in use' using errcode = '23505';
    end if;

    select * into wallet
    from public.credit_wallets
    where user_id = p_user_id;

    return jsonb_build_object(
      'reservationId', reservation.id,
      'requestId', reservation.request_id,
      'status', reservation.status,
      'freeBalance', wallet.free_balance,
      'subscriptionBalance', wallet.subscription_balance,
      'purchasedBalance', wallet.purchased_balance
    );
  end if;

  select * into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'credit wallet not found' using errcode = 'P0002';
  end if;

  -- Recheck after taking the wallet lock so concurrent retries cannot double-debit.
  select * into reservation
  from public.credit_reservations
  where request_id = p_request_id;

  if found then
    if reservation.user_id <> p_user_id
      or reservation.feature <> p_feature
      or reservation.amount <> p_amount then
      raise exception 'request ID is already in use' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'reservationId', reservation.id,
      'requestId', reservation.request_id,
      'status', reservation.status,
      'freeBalance', wallet.free_balance,
      'subscriptionBalance', wallet.subscription_balance,
      'purchasedBalance', wallet.purchased_balance
    );
  end if;

  if wallet.free_balance::bigint + wallet.subscription_balance + wallet.purchased_balance < p_amount then
    raise exception 'insufficient credits' using errcode = 'P0001';
  end if;

  free_reserved := least(wallet.free_balance, p_amount);
  subscription_reserved := least(wallet.subscription_balance, p_amount - free_reserved);
  purchased_reserved := p_amount - free_reserved - subscription_reserved;

  update public.credit_wallets
  set free_balance = free_balance - free_reserved,
      subscription_balance = subscription_balance - subscription_reserved,
      purchased_balance = purchased_balance - purchased_reserved
  where user_id = p_user_id
  returning * into wallet;

  insert into public.credit_reservations (
    user_id,
    feature,
    amount,
    request_id,
    bucket_breakdown,
    subscription_period_key,
    expires_at
  )
  values (
    p_user_id,
    p_feature,
    p_amount,
    p_request_id,
    jsonb_build_object(
      'free', free_reserved,
      'subscription', subscription_reserved,
      'purchased', purchased_reserved
    ),
    wallet.subscription_period_key,
    clock_timestamp() + interval '10 minutes'
  )
  returning * into reservation;

  insert into public.credit_transactions (
    user_id,
    amount,
    bucket,
    type,
    feature,
    reference,
    idempotency_key,
    metadata
  )
  select
    p_user_id,
    -entry.amount,
    entry.bucket,
    'reserve',
    p_feature,
    reservation.id::text,
    'reserve:' || p_request_id || ':' || entry.bucket,
    jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id)
  from (values
    ('free', free_reserved),
    ('subscription', subscription_reserved),
    ('purchased', purchased_reserved)
  ) as entry(bucket, amount)
  where entry.amount > 0;

  return jsonb_build_object(
    'reservationId', reservation.id,
    'requestId', reservation.request_id,
    'status', reservation.status,
    'freeBalance', wallet.free_balance,
    'subscriptionBalance', wallet.subscription_balance,
    'purchasedBalance', wallet.purchased_balance
  );
end;
$$;

create or replace function public.finalize_credit_reservation(
  p_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.credit_wallets%rowtype;
  reservation public.credit_reservations%rowtype;
begin
  perform 1 from auth.users where id = p_user_id for key share;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select * into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'credit wallet not found' using errcode = 'P0002';
  end if;

  select * into reservation
  from public.credit_reservations
  where request_id = p_request_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'credit reservation not found' using errcode = 'P0002';
  end if;

  if reservation.status not in ('reserved', 'spent') then
    raise exception 'credit reservation cannot be spent from status %', reservation.status using errcode = 'P0001';
  end if;

  if reservation.status = 'reserved' then
    if reservation.expires_at <= clock_timestamp() then
      raise exception 'credit reservation has expired' using errcode = 'P0001';
    end if;

    update public.credit_reservations
    set status = 'spent'
    where id = reservation.id
    returning * into reservation;

    insert into public.credit_transactions (
      user_id,
      amount,
      bucket,
      type,
      feature,
      reference,
      idempotency_key,
      metadata
    )
    select
      p_user_id,
      entry.amount,
      entry.bucket,
      'adjustment',
      reservation.feature,
      reservation.id::text,
      'release-for-spend:' || p_request_id || ':' || entry.bucket,
      jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id, 'reason', 'reservation_finalized')
    from (values
      ('free', (reservation.bucket_breakdown ->> 'free')::integer),
      ('subscription', (reservation.bucket_breakdown ->> 'subscription')::integer),
      ('purchased', (reservation.bucket_breakdown ->> 'purchased')::integer)
    ) as entry(bucket, amount)
    where entry.amount > 0;

    insert into public.credit_transactions (
      user_id,
      amount,
      bucket,
      type,
      feature,
      reference,
      idempotency_key,
      metadata
    )
    select
      p_user_id,
      -entry.amount,
      entry.bucket,
      'spend',
      reservation.feature,
      reservation.id::text,
      'spend:' || p_request_id || ':' || entry.bucket,
      jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id)
    from (values
      ('free', (reservation.bucket_breakdown ->> 'free')::integer),
      ('subscription', (reservation.bucket_breakdown ->> 'subscription')::integer),
      ('purchased', (reservation.bucket_breakdown ->> 'purchased')::integer)
    ) as entry(bucket, amount)
    where entry.amount > 0;
  end if;

  return jsonb_build_object(
    'reservationId', reservation.id,
    'requestId', reservation.request_id,
    'status', reservation.status,
    'freeBalance', wallet.free_balance,
    'subscriptionBalance', wallet.subscription_balance,
    'purchasedBalance', wallet.purchased_balance
  );
end;
$$;

create or replace function public.refund_credit_reservation(
  p_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.credit_wallets%rowtype;
  reservation public.credit_reservations%rowtype;
  free_refund integer;
  subscription_refund integer;
  subscription_expired integer;
  purchased_refund integer;
begin
  perform 1 from auth.users where id = p_user_id for key share;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select * into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'credit wallet not found' using errcode = 'P0002';
  end if;

  select * into reservation
  from public.credit_reservations
  where request_id = p_request_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'credit reservation not found' using errcode = 'P0002';
  end if;

  if reservation.status not in ('reserved', 'refunded') then
    raise exception 'credit reservation cannot be refunded from status %', reservation.status using errcode = 'P0001';
  end if;

  if reservation.status = 'reserved' then
    free_refund := (reservation.bucket_breakdown ->> 'free')::integer;
    subscription_refund := case
      when reservation.subscription_period_key is not distinct from wallet.subscription_period_key
        then (reservation.bucket_breakdown ->> 'subscription')::integer
      else 0
    end;
    subscription_expired := (reservation.bucket_breakdown ->> 'subscription')::integer - subscription_refund;
    purchased_refund := (reservation.bucket_breakdown ->> 'purchased')::integer;

    update public.credit_wallets
    set free_balance = free_balance + free_refund,
        subscription_balance = subscription_balance + subscription_refund,
        purchased_balance = purchased_balance + purchased_refund
    where user_id = p_user_id
    returning * into wallet;

    update public.credit_reservations
    set status = 'refunded'
    where id = reservation.id
    returning * into reservation;

    insert into public.credit_transactions (
      user_id,
      amount,
      bucket,
      type,
      feature,
      reference,
      idempotency_key,
      metadata
    )
    select
      p_user_id,
      entry.amount,
      entry.bucket,
      'refund',
      reservation.feature,
      reservation.id::text,
      'refund:' || p_request_id || ':' || entry.bucket,
      jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id)
    from (values
      ('free', free_refund),
      ('subscription', subscription_refund),
      ('purchased', purchased_refund)
    ) as entry(bucket, amount)
    where entry.amount > 0;

    if subscription_expired > 0 then
      insert into public.credit_transactions (
        user_id, amount, bucket, type, feature, reference, idempotency_key, metadata
      ) values (
        p_user_id,
        subscription_expired,
        'subscription',
        'adjustment',
        reservation.feature,
        reservation.id::text,
        'release-for-expiry:' || p_request_id || ':subscription',
        jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id, 'reason', 'subscription_period_changed')
      ), (
        p_user_id,
        -subscription_expired,
        'subscription',
        'expire',
        reservation.feature,
        reservation.id::text,
        'expire:' || p_request_id || ':subscription',
        jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id, 'reason', 'subscription_period_changed')
      );
    end if;
  end if;

  return jsonb_build_object(
    'reservationId', reservation.id,
    'requestId', reservation.request_id,
    'status', reservation.status,
    'freeBalance', wallet.free_balance,
    'subscriptionBalance', wallet.subscription_balance,
    'purchasedBalance', wallet.purchased_balance
  );
end;
$$;

create or replace function public.expire_credit_reservations(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  wallet public.credit_wallets%rowtype;
  reservation public.credit_reservations%rowtype;
  free_refund integer;
  subscription_refund integer;
  subscription_expired integer;
  purchased_refund integer;
  processed integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'expiration limit must be between 1 and 1000' using errcode = '22023';
  end if;

  for candidate in
    select id, user_id
    from public.credit_reservations
    where status = 'reserved' and expires_at <= clock_timestamp()
    order by expires_at, id
    limit p_limit
  loop
    perform 1 from auth.users where id = candidate.user_id for key share;
    if not found then
      continue;
    end if;

    select * into wallet
    from public.credit_wallets
    where user_id = candidate.user_id
    for update;
    if not found then
      continue;
    end if;

    select * into reservation
    from public.credit_reservations
    where id = candidate.id
      and status = 'reserved'
      and expires_at <= clock_timestamp()
    for update;
    if not found then
      continue;
    end if;

    free_refund := (reservation.bucket_breakdown ->> 'free')::integer;
    subscription_refund := case
      when reservation.subscription_period_key is not distinct from wallet.subscription_period_key
        then (reservation.bucket_breakdown ->> 'subscription')::integer
      else 0
    end;
    subscription_expired := (reservation.bucket_breakdown ->> 'subscription')::integer - subscription_refund;
    purchased_refund := (reservation.bucket_breakdown ->> 'purchased')::integer;

    update public.credit_wallets
    set free_balance = free_balance + free_refund,
        subscription_balance = subscription_balance + subscription_refund,
        purchased_balance = purchased_balance + purchased_refund
    where user_id = reservation.user_id;

    update public.credit_reservations
    set status = 'expired'
    where id = reservation.id;

    insert into public.credit_transactions (
      user_id, amount, bucket, type, feature, reference, idempotency_key, metadata
    )
    select
      reservation.user_id,
      entry.amount,
      entry.bucket,
      'refund',
      reservation.feature,
      reservation.id::text,
      'expiration-refund:' || reservation.request_id || ':' || entry.bucket,
      jsonb_build_object('reservationId', reservation.id, 'requestId', reservation.request_id, 'reason', 'reservation_expired')
    from (values
      ('free', free_refund),
      ('subscription', subscription_refund),
      ('purchased', purchased_refund)
    ) as entry(bucket, amount)
    where entry.amount > 0;

    if subscription_expired > 0 then
      insert into public.credit_transactions (
        user_id, amount, bucket, type, feature, reference, idempotency_key, metadata
      ) values (
        reservation.user_id,
        subscription_expired,
        'subscription',
        'adjustment',
        reservation.feature,
        reservation.id::text,
        'expiration-release:' || reservation.request_id || ':subscription',
        jsonb_build_object('reservationId', reservation.id, 'requestId', reservation.request_id, 'reason', 'subscription_period_changed')
      ), (
        reservation.user_id,
        -subscription_expired,
        'subscription',
        'expire',
        reservation.feature,
        reservation.id::text,
        'expiration-expire:' || reservation.request_id || ':subscription',
        jsonb_build_object('reservationId', reservation.id, 'requestId', reservation.request_id, 'reason', 'subscription_period_changed')
      );
    end if;

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.reserve_credits(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.finalize_credit_reservation(uuid, text) from public, anon, authenticated;
revoke all on function public.refund_credit_reservation(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_credit_reservations(integer) from public, anon, authenticated;

grant execute on function public.reserve_credits(uuid, text, integer, text) to service_role;
grant execute on function public.finalize_credit_reservation(uuid, text) to service_role;
grant execute on function public.refund_credit_reservation(uuid, text) to service_role;
grant execute on function public.expire_credit_reservations(integer) to service_role;

select cron.schedule(
  'stranerd-expire-credit-reservations',
  '* * * * *',
  'select public.expire_credit_reservations(100);'
);
