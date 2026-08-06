alter table public.payment_intents
  add constraint payment_intents_catalog_amount_check check (
    (product_type = 'subscription' and amount_minor = 250000)
    or (product_type = 'payg_100' and amount_minor = 50000)
  ) not valid;

alter table public.payment_intents validate constraint payment_intents_catalog_amount_check;

create unique index payment_intents_one_pending_subscription_idx
  on public.payment_intents (user_id)
  where product_type = 'subscription' and status = 'pending';

create table public.subscription_payments (
  provider_payment_id text primary key,
  provider_subscription_id text not null,
  period_key text not null,
  event_id text not null,
  created_at timestamptz not null default now(),
  unique (provider_subscription_id, period_key)
);
alter table public.subscription_payments enable row level security;
revoke all on table public.subscription_payments from public, anon, authenticated;

create table public.subscription_event_states (
  provider_subscription_id text primary key,
  status text not null check (status in ('active', 'past_due', 'cancelled', 'completed')),
  provider_updated_at timestamptz not null,
  event_id text not null,
  updated_at timestamptz not null default now()
);
alter table public.subscription_event_states enable row level security;
revoke all on table public.subscription_event_states from public, anon, authenticated;

create or replace function public.create_spotflow_payment_intent(
  p_id uuid,
  p_user_id uuid,
  p_provider_reference text,
  p_product_type text,
  p_amount_minor bigint,
  p_credits integer,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  if p_product_type = 'subscription' and (
    exists (select 1 from public.subscriptions where user_id = p_user_id and status in ('pending', 'active', 'past_due'))
    or exists (select 1 from public.payment_intents where user_id = p_user_id and product_type = 'subscription' and status = 'pending')
  ) then
    raise exception 'subscription or checkout already exists' using errcode = '23505';
  end if;
  if (p_product_type = 'subscription' and (p_amount_minor <> 250000 or p_credits <> 500))
    or (p_product_type = 'payg_100' and (p_amount_minor <> 50000 or p_credits <> 100)) then
    raise exception 'product does not match billing catalog' using errcode = '22023';
  end if;
  insert into public.payment_intents (id, user_id, provider_reference, product_type, amount_minor, currency, credits, status, metadata)
  values (p_id, p_user_id, p_provider_reference, p_product_type, p_amount_minor, 'NGN', p_credits, 'pending', p_metadata);
  return p_id;
end;
$$;

alter table public.webhook_events add column processing_started_at timestamptz;
grant update (processing_started_at) on table public.webhook_events to service_role;

create or replace function public.claim_spotflow_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.webhook_events%rowtype;
begin
  insert into public.webhook_events (provider, event_id, event_type, payload, status)
  values ('spotflow', p_event_id, p_event_type, p_payload, 'received')
  on conflict (provider, event_id) do nothing;

  select * into event_row
  from public.webhook_events
  where provider = 'spotflow' and event_id = p_event_id
  for update;

  if event_row.status in ('processed', 'ignored') then return 'terminal'; end if;
  if event_row.status = 'processing'
    and event_row.processing_started_at > clock_timestamp() - interval '2 minutes' then
    return 'busy';
  end if;

  update public.webhook_events
  set status = 'processing', processing_started_at = clock_timestamp(), error = null
  where provider = 'spotflow' and event_id = p_event_id;
  return 'claimed';
end;
$$;

create or replace function public.finish_spotflow_event(
  p_event_id text,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('processed', 'ignored', 'failed') then
    raise exception 'invalid webhook terminal status' using errcode = '22023';
  end if;
  update public.webhook_events
  set status = p_status,
      error = left(p_error, 500),
      processed_at = case when p_status in ('processed', 'ignored') then clock_timestamp() else null end
  where provider = 'spotflow' and event_id = p_event_id and status = 'processing';
end;
$$;

create or replace function public.apply_spotflow_payg_success(
  p_event_id text,
  p_payment_intent_id uuid,
  p_provider_payment_id text,
  p_provider_reference text,
  p_provider_amount bigint,
  p_provider_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.webhook_events%rowtype;
  intent public.payment_intents%rowtype;
  wallet public.credit_wallets%rowtype;
  granted boolean;
begin
  select * into event_row from public.webhook_events
  where provider = 'spotflow' and event_id = p_event_id for update;
  if not found or event_row.event_type <> 'payment_successful' or event_row.status <> 'processing' then
    raise exception 'webhook event is not a claimable PAYG success' using errcode = '22023';
  end if;

  select * into intent from public.payment_intents where id = p_payment_intent_id for update;
  if not found then raise exception 'payment intent not found' using errcode = 'P0002'; end if;
  if intent.user_id is null or intent.product_type <> 'payg_100'
    or intent.amount_minor <> 50000 or intent.currency <> 'NGN' or intent.credits <> 100
    or intent.provider_reference is distinct from p_provider_reference
    or p_provider_amount is distinct from 50000::bigint or p_provider_currency is distinct from 'NGN'
    or p_provider_payment_id is null or length(p_provider_payment_id) = 0
    or intent.status not in ('pending', 'failed', 'successful') then
    raise exception 'provider payment does not match PAYG catalog' using errcode = '22023';
  end if;
  if intent.status = 'successful' then
    if intent.provider_payment_id is distinct from p_provider_payment_id then
      raise exception 'payment intent is already bound to another payment' using errcode = '22023';
    end if;
    perform public.finish_spotflow_event(p_event_id, 'processed');
    return jsonb_build_object('status', 'processed', 'duplicate', true);
  end if;
  select * into wallet from public.credit_wallets where user_id = intent.user_id for update;
  if not found then raise exception 'credit wallet not found' using errcode = 'P0002'; end if;

  with inserted as (
    insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
    values (intent.user_id, 100, 'purchased', 'grant', 'payg', p_provider_payment_id,
      'payg:' || p_provider_payment_id,
      jsonb_build_object('paymentIntentId', intent.id, 'providerReference', p_provider_reference))
    on conflict (idempotency_key) do nothing returning true
  ) select coalesce(bool_or(true), false) into granted from inserted;

  if granted then
    update public.credit_wallets set purchased_balance = purchased_balance + 100
    where user_id = intent.user_id returning * into wallet;
  end if;
  update public.payment_intents set status = 'successful', provider_payment_id = p_provider_payment_id where id = intent.id;
  perform public.finish_spotflow_event(p_event_id, 'processed');
  return jsonb_build_object('status', 'processed', 'duplicate', not granted,
    'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
end;
$$;

create or replace function public.apply_spotflow_subscription_success(
  p_event_id text,
  p_payment_intent_id uuid,
  p_provider_payment_id text,
  p_provider_reference text,
  p_provider_subscription_id text,
  p_provider_plan_id text,
  p_provider_amount bigint,
  p_provider_currency text,
  p_period_key text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_provider_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.webhook_events%rowtype;
  intent public.payment_intents%rowtype;
  wallet public.credit_wallets%rowtype;
  subscription_row public.subscriptions%rowtype;
  live_subscription public.subscriptions%rowtype;
  provider_state public.subscription_event_states%rowtype;
  billing_user_id uuid;
  granted boolean;
  previous_balance integer;
begin
  if p_provider_payment_id is null or length(p_provider_payment_id) = 0
    or p_provider_subscription_id is null or length(p_provider_subscription_id) = 0
    or p_provider_plan_id is null or length(p_provider_plan_id) = 0
    or p_period_key is null or length(p_period_key) = 0
    or p_period_start is null or p_period_end is null or p_period_end <= p_period_start
    or p_provider_updated_at is null
    or p_provider_amount <> 2500 or p_provider_currency <> 'NGN' then
    raise exception 'subscription payment fields do not match the configured plan' using errcode = '22023';
  end if;

  select * into event_row from public.webhook_events
  where provider = 'spotflow' and event_id = p_event_id for update;
  if not found or event_row.event_type not in ('payment_successful', 'subscription_successful') or event_row.status <> 'processing' then
    raise exception 'webhook event is not a claimable subscription success' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider_payment_id, 2));
  perform pg_advisory_xact_lock(hashtextextended(p_provider_subscription_id, 0));
  select * into provider_state from public.subscription_event_states
  where provider_subscription_id = p_provider_subscription_id for update;
  if found and (provider_state.provider_updated_at > p_provider_updated_at
    or (provider_state.provider_updated_at = p_provider_updated_at and provider_state.status <> 'active')) then
    perform public.finish_spotflow_event(p_event_id, 'ignored');
    return jsonb_build_object('status', 'ignored', 'stale', true);
  end if;
  select * into subscription_row from public.subscriptions
  where provider_subscription_id = p_provider_subscription_id for update;
  if found and subscription_row.provider_updated_at is not null
    and p_provider_updated_at < subscription_row.provider_updated_at then
    perform public.finish_spotflow_event(p_event_id, 'ignored');
    return jsonb_build_object('status', 'ignored', 'stale', true);
  end if;

  if p_payment_intent_id is not null then
    select * into intent from public.payment_intents where id = p_payment_intent_id for update;
    if not found then raise exception 'payment intent not found' using errcode = 'P0002'; end if;
    if intent.user_id is null or intent.product_type <> 'subscription'
      or intent.amount_minor <> 250000 or intent.currency <> 'NGN' or intent.credits <> 500
      or intent.provider_reference is distinct from p_provider_reference
      or intent.status not in ('pending', 'failed', 'successful') then
      raise exception 'payment intent does not match subscription catalog' using errcode = '22023';
    end if;
    if intent.status = 'successful' then
      if intent.provider_payment_id is distinct from p_provider_payment_id then
        raise exception 'payment intent is already bound to another payment' using errcode = '22023';
      end if;
      perform public.finish_spotflow_event(p_event_id, 'processed');
      return jsonb_build_object('status', 'processed', 'duplicate', true);
    end if;
    billing_user_id := intent.user_id;
    if subscription_row.id is not null and subscription_row.user_id is distinct from billing_user_id then
      raise exception 'subscription owner mismatch' using errcode = '22023';
    end if;
  else
    if subscription_row.id is null or subscription_row.user_id is null then
      raise exception 'renewal subscription was not found' using errcode = 'P0002';
    end if;
    billing_user_id := subscription_row.user_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(billing_user_id::text, 1));

  select * into live_subscription from public.subscriptions
  where user_id = billing_user_id and status in ('pending', 'active', 'past_due')
    and provider_subscription_id <> p_provider_subscription_id
  for update;
  if found then
    raise exception 'another live subscription already exists' using errcode = '23505';
  end if;

  if subscription_row.id is not null and subscription_row.provider_updated_at = p_provider_updated_at
    and coalesce(subscription_row.metadata ->> 'lastPeriodKey', '') <> p_period_key then
    perform public.finish_spotflow_event(p_event_id, 'ignored');
    return jsonb_build_object('status', 'ignored', 'stale', true);
  end if;

  select * into wallet from public.credit_wallets where user_id = billing_user_id for update;
  if not found then raise exception 'credit wallet not found' using errcode = 'P0002'; end if;
  previous_balance := wallet.subscription_balance;

  if exists (select 1 from public.subscription_payments where provider_payment_id = p_provider_payment_id
    and (provider_subscription_id <> p_provider_subscription_id or period_key <> p_period_key)) then
    raise exception 'provider payment is already bound to another subscription cycle' using errcode = '23505';
  end if;
  if exists (select 1 from public.subscription_payments where provider_subscription_id = p_provider_subscription_id
    and period_key = p_period_key and provider_payment_id <> p_provider_payment_id) then
    raise exception 'subscription cycle already has another provider payment' using errcode = '23505';
  end if;
  insert into public.subscription_payments (provider_payment_id, provider_subscription_id, period_key, event_id)
  values (p_provider_payment_id, p_provider_subscription_id, p_period_key, p_event_id)
  on conflict (provider_payment_id) do nothing;

  with inserted as (
    insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
    values (billing_user_id, 500, 'subscription', 'grant', 'subscription', p_provider_payment_id,
      'subscription:' || p_provider_subscription_id || ':' || p_period_key,
      jsonb_build_object('paymentIntentId', p_payment_intent_id, 'periodKey', p_period_key))
    on conflict (idempotency_key) do nothing returning true
  ) select coalesce(bool_or(true), false) into granted from inserted;

  if granted then
    if previous_balance > 0 then
      insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
      values (billing_user_id, -previous_balance, 'subscription', 'expire', 'subscription', p_provider_payment_id,
        'subscription-expire:' || p_provider_subscription_id || ':' || p_period_key,
        jsonb_build_object('previousPeriodKey', wallet.subscription_period_key, 'newPeriodKey', p_period_key));
    end if;
    update public.credit_wallets set subscription_balance = 500, subscription_period_key = p_provider_subscription_id || ':' || p_period_key
    where user_id = billing_user_id returning * into wallet;
  end if;

  insert into public.subscriptions (user_id, provider_subscription_id, provider_plan_id, status,
    current_period_start, current_period_end, provider_updated_at, cancel_at_period_end, metadata)
  values (billing_user_id, p_provider_subscription_id, p_provider_plan_id, 'active',
    p_period_start, p_period_end, p_provider_updated_at, false,
    jsonb_build_object('lastPeriodKey', p_period_key, 'lastWalletPeriodKey', p_provider_subscription_id || ':' || p_period_key))
  on conflict (provider_subscription_id) do update set
    provider_plan_id = excluded.provider_plan_id, status = 'active',
    current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
    provider_updated_at = excluded.provider_updated_at, cancel_at_period_end = false,
    metadata = public.subscriptions.metadata || excluded.metadata;

  insert into public.subscription_event_states (provider_subscription_id, status, provider_updated_at, event_id)
  values (p_provider_subscription_id, 'active', p_provider_updated_at, p_event_id)
  on conflict (provider_subscription_id) do update set
    status = excluded.status, provider_updated_at = excluded.provider_updated_at,
    event_id = excluded.event_id, updated_at = clock_timestamp()
  where excluded.provider_updated_at > public.subscription_event_states.provider_updated_at
    or (excluded.provider_updated_at = public.subscription_event_states.provider_updated_at
      and excluded.status in ('cancelled', 'completed')
      and public.subscription_event_states.status not in ('cancelled', 'completed'))
    or (excluded.provider_updated_at = public.subscription_event_states.provider_updated_at
      and excluded.status = 'completed' and public.subscription_event_states.status = 'cancelled');

  if p_payment_intent_id is not null then
    update public.payment_intents set status = 'successful', provider_payment_id = p_provider_payment_id where id = p_payment_intent_id;
  end if;
  perform public.finish_spotflow_event(p_event_id, 'processed');
  return jsonb_build_object('status', 'processed', 'duplicate', not granted,
    'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
end;
$$;

create or replace function public.apply_spotflow_subscription_state(
  p_event_id text,
  p_provider_subscription_id text,
  p_status text,
  p_provider_updated_at timestamptz,
  p_payment_intent_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.webhook_events%rowtype;
  subscription_row public.subscriptions%rowtype;
  wallet public.credit_wallets%rowtype;
begin
  if p_status not in ('past_due', 'cancelled', 'completed') or p_provider_updated_at is null then
    raise exception 'invalid subscription transition' using errcode = '22023';
  end if;
  select * into event_row from public.webhook_events
  where provider = 'spotflow' and event_id = p_event_id for update;
  if not found or event_row.status <> 'processing'
    or (p_status = 'past_due' and event_row.event_type not in ('payment_failed', 'subscription_failed', 'subscription_payment_failed'))
    or (p_status = 'cancelled' and event_row.event_type <> 'subscription_cancelled')
    or (p_status = 'completed' and event_row.event_type <> 'subscription_completed') then
    raise exception 'webhook event is not claimable for this transition' using errcode = '22023';
  end if;

  insert into public.subscription_event_states (provider_subscription_id, status, provider_updated_at, event_id)
  values (p_provider_subscription_id, p_status, p_provider_updated_at, p_event_id)
  on conflict (provider_subscription_id) do update set
    status = excluded.status, provider_updated_at = excluded.provider_updated_at,
    event_id = excluded.event_id, updated_at = clock_timestamp()
  where excluded.provider_updated_at > public.subscription_event_states.provider_updated_at
    or (excluded.provider_updated_at = public.subscription_event_states.provider_updated_at
      and excluded.status in ('cancelled', 'completed')
      and public.subscription_event_states.status not in ('cancelled', 'completed'))
    or (excluded.provider_updated_at = public.subscription_event_states.provider_updated_at
      and excluded.status = 'completed' and public.subscription_event_states.status = 'cancelled');
  if not found then
    perform public.finish_spotflow_event(p_event_id, 'ignored');
    return 'ignored';
  end if;

  select * into subscription_row from public.subscriptions
  where provider_subscription_id = p_provider_subscription_id for update;
  if not found then
    perform public.finish_spotflow_event(p_event_id, 'ignored');
    return 'ignored';
  end if;
  if subscription_row.provider_updated_at is not null and p_provider_updated_at <= subscription_row.provider_updated_at then
    perform public.finish_spotflow_event(p_event_id, 'ignored');
    return 'ignored';
  end if;

  update public.subscriptions
  set status = case when p_status = 'cancelled' and current_period_end > clock_timestamp() then status else p_status end,
      cancel_at_period_end = p_status in ('cancelled', 'completed'),
      provider_updated_at = p_provider_updated_at
  where id = subscription_row.id;
  if p_payment_intent_id is not null then
    update public.payment_intents set status = 'failed'
    where id = p_payment_intent_id and status = 'pending';
  end if;

  if p_status in ('completed', 'cancelled') and subscription_row.current_period_end <= clock_timestamp() and subscription_row.user_id is not null then
    select * into wallet from public.credit_wallets where user_id = subscription_row.user_id for update;
    if found and wallet.subscription_balance > 0
      and wallet.subscription_period_key = subscription_row.metadata ->> 'lastWalletPeriodKey' then
      insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
      values (subscription_row.user_id, -wallet.subscription_balance, 'subscription', 'expire', 'subscription', p_event_id,
        'subscription-completed:' || p_provider_subscription_id || ':' || p_event_id,
        jsonb_build_object('periodKey', wallet.subscription_period_key));
      update public.credit_wallets set subscription_balance = 0, subscription_period_key = null
      where user_id = subscription_row.user_id;
    end if;
  end if;
  perform public.finish_spotflow_event(p_event_id, 'processed');
  return 'processed';
end;
$$;

create or replace function public.expire_ended_spotflow_subscriptions(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_row public.subscriptions%rowtype;
  wallet public.credit_wallets%rowtype;
  processed integer := 0;
  wallet_period_key text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'expiration limit must be between 1 and 1000' using errcode = '22023';
  end if;
  for subscription_row in
    select * from public.subscriptions
    where status in ('active', 'cancelled') and current_period_end <= clock_timestamp()
    order by current_period_end, id limit p_limit for update skip locked
  loop
    wallet_period_key := subscription_row.metadata ->> 'lastWalletPeriodKey';
    if subscription_row.user_id is not null then
      select * into wallet from public.credit_wallets where user_id = subscription_row.user_id for update;
      if found and wallet.subscription_balance > 0 and wallet.subscription_period_key = wallet_period_key then
        insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
        values (subscription_row.user_id, -wallet.subscription_balance, 'subscription', 'expire', 'subscription', subscription_row.provider_subscription_id,
          'subscription-period-ended:' || subscription_row.provider_subscription_id || ':' || coalesce(wallet_period_key, 'unknown'),
          jsonb_build_object('periodKey', wallet_period_key));
        update public.credit_wallets set subscription_balance = 0, subscription_period_key = null
        where user_id = subscription_row.user_id;
      end if;
    end if;
    update public.subscriptions set status = 'completed', cancel_at_period_end = true where id = subscription_row.id;
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

select cron.schedule(
  'stranerd-expire-ended-subscriptions',
  '*/10 * * * *',
  'select public.expire_ended_spotflow_subscriptions(100);'
);

revoke all on function public.claim_spotflow_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_spotflow_payment_intent(uuid, uuid, text, text, bigint, integer, jsonb) from public, anon, authenticated;
revoke all on function public.finish_spotflow_event(text, text, text) from public, anon, authenticated;
revoke all on function public.apply_spotflow_payg_success(text, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.apply_spotflow_subscription_success(text, uuid, text, text, text, text, bigint, text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_spotflow_subscription_state(text, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.expire_ended_spotflow_subscriptions(integer) from public, anon, authenticated;
grant execute on function public.claim_spotflow_event(text, text, jsonb) to service_role;
grant execute on function public.create_spotflow_payment_intent(uuid, uuid, text, text, bigint, integer, jsonb) to service_role;
grant execute on function public.finish_spotflow_event(text, text, text) to service_role;
grant execute on function public.apply_spotflow_payg_success(text, uuid, text, text, bigint, text) to service_role;
grant execute on function public.apply_spotflow_subscription_success(text, uuid, text, text, text, text, bigint, text, text, timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function public.apply_spotflow_subscription_state(text, text, text, timestamptz, uuid) to service_role;
grant execute on function public.expire_ended_spotflow_subscriptions(integer) to service_role;
