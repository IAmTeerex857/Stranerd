alter table public.subscriptions drop constraint subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check check (provider in ('spotflow', 'bachs'));

alter table public.payment_intents add column provider text;
update public.payment_intents set provider = 'spotflow' where provider is null;
alter table public.payment_intents alter column provider set not null;
alter table public.payment_intents alter column provider set default 'spotflow';
alter table public.payment_intents add constraint payment_intents_provider_check check (provider in ('spotflow', 'bachs'));

alter table public.webhook_events drop constraint webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check check (provider in ('spotflow', 'bachs'));
alter table public.payment_intents drop constraint payment_intents_currency_check;
alter table public.payment_intents add constraint payment_intents_currency_check check (currency in ('NGN', 'USD'));
alter table public.payment_intents drop constraint payment_intents_catalog_amount_check;
alter table public.payment_intents add constraint payment_intents_catalog_amount_check check (
  (provider = 'spotflow' and currency = 'NGN' and product_type = 'subscription' and amount_minor = 250000)
  or (provider = 'spotflow' and currency = 'NGN' and product_type = 'payg_100' and amount_minor = 50000)
  or (provider = 'bachs' and currency = 'USD' and product_type = 'subscription' and amount_minor = 500)
  or (provider = 'bachs' and currency = 'USD' and product_type = 'payg_100' and amount_minor = 200)
);

alter table public.payment_intents drop constraint payment_intents_provider_reference_key;
create unique index payment_intents_provider_reference_idx on public.payment_intents (provider, provider_reference);
drop index public.payment_intents_provider_payment_idx;
create unique index payment_intents_provider_payment_idx on public.payment_intents (provider, provider_payment_id) where provider_payment_id is not null;

alter table public.subscriptions drop constraint subscriptions_provider_subscription_id_key;
alter table public.subscriptions add constraint subscriptions_provider_subscription_unique unique (provider, provider_subscription_id);
-- Legacy Spotflow RPCs target the original conflict key; provider-prefixed IDs make cross-provider collisions non-viable.
create unique index subscriptions_legacy_provider_subscription_idx on public.subscriptions (provider_subscription_id);

alter table public.subscription_payments add column provider text not null default 'spotflow' check (provider in ('spotflow', 'bachs'));
alter table public.subscription_payments drop constraint subscription_payments_pkey;
alter table public.subscription_payments drop constraint subscription_payments_provider_subscription_id_period_key_key;
alter table public.subscription_payments add primary key (provider, provider_payment_id);
alter table public.subscription_payments add unique (provider, provider_subscription_id, period_key);
create unique index subscription_payments_legacy_payment_idx on public.subscription_payments (provider_payment_id);
create unique index subscription_payments_legacy_cycle_idx on public.subscription_payments (provider_subscription_id, period_key);

alter table public.subscription_event_states add column provider text not null default 'spotflow' check (provider in ('spotflow', 'bachs'));
alter table public.subscription_event_states drop constraint subscription_event_states_pkey;
alter table public.subscription_event_states add primary key (provider, provider_subscription_id);
create unique index subscription_event_states_legacy_subscription_idx on public.subscription_event_states (provider_subscription_id);

create or replace function public.create_billing_payment_intent(
  p_id uuid, p_user_id uuid, p_provider text, p_provider_reference text,
  p_product_type text, p_amount_minor bigint, p_currency text, p_credits integer, p_metadata jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_provider not in ('spotflow', 'bachs') then raise exception 'invalid billing provider' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  if p_product_type = 'subscription' and (
    exists (select 1 from public.subscriptions where user_id = p_user_id and status in ('pending', 'active', 'past_due'))
    or exists (select 1 from public.payment_intents where user_id = p_user_id and product_type = 'subscription' and status = 'pending')
  ) then raise exception 'subscription or checkout already exists' using errcode = '23505'; end if;
  if not (
    (p_provider = 'spotflow' and p_currency = 'NGN' and p_product_type = 'subscription' and p_amount_minor = 250000 and p_credits = 500)
    or (p_provider = 'spotflow' and p_currency = 'NGN' and p_product_type = 'payg_100' and p_amount_minor = 50000 and p_credits = 100)
    or (p_provider = 'bachs' and p_currency = 'USD' and p_product_type = 'subscription' and p_amount_minor = 500 and p_credits = 500)
    or (p_provider = 'bachs' and p_currency = 'USD' and p_product_type = 'payg_100' and p_amount_minor = 200 and p_credits = 100)
  ) then raise exception 'product does not match billing catalog' using errcode = '22023'; end if;
  insert into public.payment_intents (id, user_id, provider, provider_reference, product_type, amount_minor, currency, credits, status, metadata)
  values (p_id, p_user_id, p_provider, p_provider_reference, p_product_type, p_amount_minor, p_currency, p_credits, 'pending', coalesce(p_metadata, '{}'::jsonb));
  return p_id;
end;
$$;

create or replace function public.claim_billing_event(p_provider text, p_event_id text, p_event_type text, p_payload jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare event_row public.webhook_events%rowtype;
begin
  if p_provider not in ('spotflow', 'bachs') then raise exception 'invalid billing provider' using errcode = '22023'; end if;
  insert into public.webhook_events (provider, event_id, event_type, payload, status)
  values (p_provider, p_event_id, p_event_type, p_payload, 'received') on conflict (provider, event_id) do nothing;
  select * into event_row from public.webhook_events where provider = p_provider and event_id = p_event_id for update;
  if event_row.status in ('processed', 'ignored') then return 'terminal'; end if;
  if event_row.status = 'processing' and event_row.processing_started_at > clock_timestamp() - interval '2 minutes' then return 'busy'; end if;
  update public.webhook_events set status = 'processing', processing_started_at = clock_timestamp(), error = null
  where provider = p_provider and event_id = p_event_id;
  return 'claimed';
end;
$$;

create or replace function public.finish_billing_event(p_provider text, p_event_id text, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_provider not in ('spotflow', 'bachs') or p_status not in ('processed', 'ignored', 'failed') then
    raise exception 'invalid webhook terminal state' using errcode = '22023';
  end if;
  update public.webhook_events set status = p_status, error = left(p_error, 500),
    processed_at = case when p_status in ('processed', 'ignored') then clock_timestamp() else null end
  where provider = p_provider and event_id = p_event_id and status = 'processing';
end;
$$;

create or replace function public.apply_bachs_payg_success(
  p_event_id text, p_payment_intent_id uuid, p_provider_payment_id text,
  p_provider_reference text, p_provider_amount_minor bigint, p_provider_currency text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event_row public.webhook_events%rowtype;
  intent public.payment_intents%rowtype;
  wallet public.credit_wallets%rowtype;
  granted boolean;
begin
  select * into event_row from public.webhook_events where provider = 'bachs' and event_id = p_event_id for update;
  if not found or event_row.event_type <> 'collection.succeeded' or event_row.status <> 'processing' then
    raise exception 'webhook event is not a claimable Bachs collection' using errcode = '22023';
  end if;
  select * into intent from public.payment_intents where id = p_payment_intent_id and provider = 'bachs' for update;
  if not found or intent.user_id is null or intent.product_type <> 'payg_100' or intent.amount_minor <> 200
    or intent.currency <> 'USD' or intent.credits <> 100 or intent.provider_reference is distinct from p_provider_reference
    or p_provider_amount_minor <> 200 or p_provider_currency <> 'USD' or coalesce(p_provider_payment_id, '') = ''
    or intent.status not in ('pending', 'failed', 'successful') then
    raise exception 'Bachs collection does not match PAYG catalog' using errcode = '22023';
  end if;
  if intent.status = 'successful' then
    if intent.provider_payment_id is distinct from p_provider_payment_id then raise exception 'intent is bound to another payment' using errcode = '22023'; end if;
    perform public.finish_billing_event('bachs', p_event_id, 'processed');
    return jsonb_build_object('status', 'processed', 'duplicate', true);
  end if;
  select * into wallet from public.credit_wallets where user_id = intent.user_id for update;
  if not found then raise exception 'credit wallet not found' using errcode = 'P0002'; end if;
  with inserted as (
    insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
    values (intent.user_id, 100, 'purchased', 'grant', 'payg', p_provider_payment_id,
      'bachs:payg:' || p_provider_payment_id, jsonb_build_object('paymentIntentId', intent.id, 'provider', 'bachs'))
    on conflict (idempotency_key) do nothing returning true
  ) select coalesce(bool_or(true), false) into granted from inserted;
  if granted then update public.credit_wallets set purchased_balance = purchased_balance + 100 where user_id = intent.user_id returning * into wallet; end if;
  update public.payment_intents set status = 'successful', provider_payment_id = p_provider_payment_id where id = intent.id;
  perform public.finish_billing_event('bachs', p_event_id, 'processed');
  return jsonb_build_object('status', 'processed', 'duplicate', not granted);
end;
$$;

create or replace function public.apply_bachs_subscription_cycle(
  p_event_id text, p_payment_intent_id uuid, p_provider_payment_id text, p_provider_subscription_id text,
  p_provider_plan_id text, p_provider_amount_minor bigint, p_provider_currency text, p_period_key text,
  p_period_start timestamptz, p_period_end timestamptz, p_provider_updated_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event_row public.webhook_events%rowtype;
  intent public.payment_intents%rowtype;
  subscription_row public.subscriptions%rowtype;
  other_subscription public.subscriptions%rowtype;
  wallet public.credit_wallets%rowtype;
  billing_user_id uuid;
  previous_balance integer;
  granted boolean;
begin
  if coalesce(p_provider_payment_id, '') = '' or coalesce(p_provider_subscription_id, '') = '' or coalesce(p_provider_plan_id, '') = ''
    or coalesce(p_period_key, '') = '' or p_provider_amount_minor <> 500 or p_provider_currency <> 'USD'
    or p_period_start is null or p_period_end is null or p_period_end <= p_period_start or p_provider_updated_at is null then
    raise exception 'Bachs invoice does not match subscription catalog' using errcode = '22023';
  end if;
  select * into event_row from public.webhook_events where provider = 'bachs' and event_id = p_event_id for update;
  if not found or event_row.event_type <> 'invoice.paid' or event_row.status <> 'processing' then
    raise exception 'webhook event is not a claimable Bachs invoice' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bachs:' || p_provider_subscription_id, 0));
  select * into subscription_row from public.subscriptions where provider = 'bachs' and provider_subscription_id = p_provider_subscription_id for update;
  if subscription_row.id is not null and (
    subscription_row.current_period_end > p_period_end
    or subscription_row.provider_updated_at > p_provider_updated_at
    or (subscription_row.current_period_end = p_period_end
      and coalesce(subscription_row.metadata ->> 'lastPeriodKey', '') not in ('', p_period_key))
  ) then
    perform public.finish_billing_event('bachs', p_event_id, 'ignored');
    return jsonb_build_object('status', 'ignored', 'stale', true);
  end if;
  if p_payment_intent_id is not null then
    select * into intent from public.payment_intents where id = p_payment_intent_id and provider = 'bachs' for update;
    if not found or intent.user_id is null or intent.product_type <> 'subscription' or intent.amount_minor <> 500
      or intent.currency <> 'USD' or intent.credits <> 500 or intent.status not in ('pending', 'failed', 'successful') then
      raise exception 'payment intent does not match Bachs subscription catalog' using errcode = '22023';
    end if;
    billing_user_id := intent.user_id;
    if subscription_row.id is not null and subscription_row.user_id is distinct from billing_user_id then raise exception 'subscription owner mismatch' using errcode = '22023'; end if;
  else
    if subscription_row.id is null or subscription_row.user_id is null then raise exception 'Bachs subscription owner was not verified' using errcode = 'P0002'; end if;
    billing_user_id := subscription_row.user_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(billing_user_id::text, 1));
  select * into other_subscription from public.subscriptions where user_id = billing_user_id and status in ('pending', 'active', 'past_due')
    and (provider <> 'bachs' or provider_subscription_id <> p_provider_subscription_id) for update;
  if found then raise exception 'another live subscription already exists' using errcode = '23505'; end if;
  select * into wallet from public.credit_wallets where user_id = billing_user_id for update;
  if not found then raise exception 'credit wallet not found' using errcode = 'P0002'; end if;
  previous_balance := wallet.subscription_balance;
  insert into public.subscription_payments (provider, provider_payment_id, provider_subscription_id, period_key, event_id)
  values ('bachs', p_provider_payment_id, p_provider_subscription_id, p_period_key, p_event_id)
  on conflict (provider, provider_payment_id) do nothing;
  with inserted as (
    insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
    values (billing_user_id, 500, 'subscription', 'grant', 'subscription', p_provider_payment_id,
      'bachs:subscription:' || p_provider_subscription_id || ':' || p_period_key,
      jsonb_build_object('paymentIntentId', p_payment_intent_id, 'periodKey', p_period_key, 'provider', 'bachs'))
    on conflict (idempotency_key) do nothing returning true
  ) select coalesce(bool_or(true), false) into granted from inserted;
  if granted then
    if previous_balance > 0 then
      insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
      values (billing_user_id, -previous_balance, 'subscription', 'expire', 'subscription', p_provider_payment_id,
        'bachs:subscription-expire:' || p_provider_subscription_id || ':' || p_period_key,
        jsonb_build_object('previousPeriodKey', wallet.subscription_period_key, 'newPeriodKey', p_period_key));
    end if;
    update public.credit_wallets set subscription_balance = 500, subscription_period_key = 'bachs:' || p_provider_subscription_id || ':' || p_period_key
    where user_id = billing_user_id;
  end if;
  insert into public.subscriptions (user_id, provider, provider_subscription_id, provider_plan_id, status, current_period_start,
    current_period_end, provider_updated_at, cancel_at_period_end, metadata)
  values (billing_user_id, 'bachs', p_provider_subscription_id, p_provider_plan_id, 'active', p_period_start, p_period_end,
    p_provider_updated_at, coalesce(subscription_row.cancel_at_period_end, false),
    coalesce(subscription_row.metadata, '{}'::jsonb) || jsonb_build_object('bachsStatus', 'active', 'lastPeriodKey', p_period_key, 'lastWalletPeriodKey', 'bachs:' || p_provider_subscription_id || ':' || p_period_key))
  on conflict (provider, provider_subscription_id) do update set provider_plan_id = excluded.provider_plan_id, status = 'active',
    current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
    provider_updated_at = excluded.provider_updated_at, metadata = public.subscriptions.metadata || excluded.metadata;
  insert into public.subscription_event_states (provider, provider_subscription_id, status, provider_updated_at, event_id)
  values ('bachs', p_provider_subscription_id, 'active', p_provider_updated_at, p_event_id)
  on conflict (provider, provider_subscription_id) do update set status = excluded.status, provider_updated_at = excluded.provider_updated_at,
    event_id = excluded.event_id, updated_at = clock_timestamp()
  where excluded.provider_updated_at > public.subscription_event_states.provider_updated_at
    or (excluded.provider_updated_at = public.subscription_event_states.provider_updated_at
      and public.subscription_event_states.status <> 'cancelled');
  if p_payment_intent_id is not null then update public.payment_intents set status = 'successful', provider_payment_id = p_provider_payment_id where id = p_payment_intent_id; end if;
  perform public.finish_billing_event('bachs', p_event_id, 'processed');
  return jsonb_build_object('status', 'processed', 'duplicate', not granted);
end;
$$;

create or replace function public.apply_bachs_subscription_state(
  p_event_id text, p_payment_intent_id uuid, p_provider_subscription_id text, p_provider_plan_id text,
  p_status text, p_period_start timestamptz, p_period_end timestamptz, p_cancel_at_period_end boolean, p_provider_updated_at timestamptz
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  event_row public.webhook_events%rowtype;
  intent public.payment_intents%rowtype;
  subscription_row public.subscriptions%rowtype;
  billing_user_id uuid;
begin
  if p_status not in ('active', 'past_due', 'cancelled') or coalesce(p_provider_subscription_id, '') = '' or coalesce(p_provider_plan_id, '') = ''
    or p_period_start is null or p_period_end is null or p_period_end <= p_period_start or p_provider_updated_at is null then
    raise exception 'invalid Bachs subscription state' using errcode = '22023';
  end if;
  select * into event_row from public.webhook_events where provider = 'bachs' and event_id = p_event_id for update;
  if not found or event_row.status <> 'processing' or event_row.event_type not in
    ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then
    raise exception 'webhook event is not a claimable Bachs subscription event' using errcode = '22023';
  end if;
  select * into subscription_row from public.subscriptions where provider = 'bachs' and provider_subscription_id = p_provider_subscription_id for update;
  if p_payment_intent_id is not null then
    select * into intent from public.payment_intents where id = p_payment_intent_id and provider = 'bachs' for update;
    if not found or intent.user_id is null or intent.product_type <> 'subscription' or intent.amount_minor <> 500 or intent.currency <> 'USD' then
      raise exception 'Bachs subscription intent mismatch' using errcode = '22023';
    end if;
    billing_user_id := intent.user_id;
  elsif subscription_row.id is not null then billing_user_id := subscription_row.user_id;
  else
    perform public.finish_billing_event('bachs', p_event_id, 'ignored');
    return 'ignored';
  end if;
  if subscription_row.id is not null and subscription_row.user_id is distinct from billing_user_id then raise exception 'subscription owner mismatch' using errcode = '22023'; end if;
  if subscription_row.provider_updated_at is not null and subscription_row.provider_updated_at > p_provider_updated_at then
    perform public.finish_billing_event('bachs', p_event_id, 'ignored'); return 'ignored';
  end if;
  if subscription_row.provider_updated_at = p_provider_updated_at
    and subscription_row.metadata ->> 'bachsStatus' = 'cancelled' and p_status <> 'cancelled' then
    perform public.finish_billing_event('bachs', p_event_id, 'ignored'); return 'ignored';
  end if;
  insert into public.subscriptions (user_id, provider, provider_subscription_id, provider_plan_id, status, current_period_start,
    current_period_end, provider_updated_at, cancel_at_period_end, metadata)
  values (billing_user_id, 'bachs', p_provider_subscription_id, p_provider_plan_id,
    case when p_status = 'active' then 'pending' else p_status end, p_period_start, p_period_end, p_provider_updated_at,
    p_cancel_at_period_end, jsonb_build_object('bachsStatus', p_status))
  on conflict (provider, provider_subscription_id) do update set
    status = case
      when p_status = 'active' then public.subscriptions.status
      when excluded.status = 'cancelled' and public.subscriptions.status in ('active', 'past_due')
        and public.subscriptions.current_period_end > clock_timestamp() then public.subscriptions.status
      else excluded.status
    end,
    provider_plan_id = excluded.provider_plan_id, current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end, provider_updated_at = excluded.provider_updated_at,
    cancel_at_period_end = excluded.cancel_at_period_end, metadata = public.subscriptions.metadata || excluded.metadata;
  insert into public.subscription_event_states (provider, provider_subscription_id, status, provider_updated_at, event_id)
  values ('bachs', p_provider_subscription_id, p_status, p_provider_updated_at, p_event_id)
  on conflict (provider, provider_subscription_id) do update set status = excluded.status, provider_updated_at = excluded.provider_updated_at,
    event_id = excluded.event_id, updated_at = clock_timestamp()
  where excluded.provider_updated_at > public.subscription_event_states.provider_updated_at
    or (excluded.provider_updated_at = public.subscription_event_states.provider_updated_at
      and excluded.status = 'cancelled' and public.subscription_event_states.status <> 'cancelled');
  if p_status = 'cancelled' and p_payment_intent_id is not null then
    update public.payment_intents set status = 'cancelled'
    where id = p_payment_intent_id and provider = 'bachs' and status = 'pending';
  end if;
  perform public.finish_billing_event('bachs', p_event_id, 'processed');
  return 'processed';
end;
$$;

create or replace function public.mark_billing_cancellation_requested(p_user_id uuid, p_subscription_id uuid, p_requested_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_requested_at is null then raise exception 'cancellation timestamp is required' using errcode = '22023'; end if;
  update public.subscriptions
  set cancel_at_period_end = true,
      metadata = metadata || jsonb_build_object('cancellationRequestedAt', p_requested_at)
  where id = p_subscription_id and user_id = p_user_id and status in ('active', 'past_due');
  return found;
end;
$$;

create or replace function public.expire_ended_spotflow_subscriptions(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare subscription_row public.subscriptions%rowtype; wallet public.credit_wallets%rowtype; processed integer := 0; wallet_period_key text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then raise exception 'expiration limit must be between 1 and 1000' using errcode = '22023'; end if;
  for subscription_row in select * from public.subscriptions
    where status in ('active', 'past_due', 'cancelled') and current_period_end <= clock_timestamp()
    order by current_period_end, id limit p_limit for update skip locked
  loop
    wallet_period_key := subscription_row.metadata ->> 'lastWalletPeriodKey';
    if subscription_row.user_id is not null then
      select * into wallet from public.credit_wallets where user_id = subscription_row.user_id for update;
      if found and wallet.subscription_balance > 0 and wallet.subscription_period_key = wallet_period_key then
        insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
        values (subscription_row.user_id, -wallet.subscription_balance, 'subscription', 'expire', 'subscription', subscription_row.provider_subscription_id,
          subscription_row.provider || ':subscription-period-ended:' || subscription_row.provider_subscription_id || ':' || coalesce(wallet_period_key, 'unknown'),
          jsonb_build_object('periodKey', wallet_period_key, 'provider', subscription_row.provider)) on conflict (idempotency_key) do nothing;
        update public.credit_wallets set subscription_balance = 0, subscription_period_key = null where user_id = subscription_row.user_id;
      end if;
    end if;
    update public.subscriptions set status = 'completed', cancel_at_period_end = true,
      metadata = metadata || jsonb_build_object('expiredAt', clock_timestamp()) where id = subscription_row.id;
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

revoke all on function public.create_billing_payment_intent(uuid, uuid, text, text, text, bigint, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.claim_billing_event(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_billing_event(text, text, text, text) from public, anon, authenticated;
revoke all on function public.apply_bachs_payg_success(text, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.apply_bachs_subscription_cycle(text, uuid, text, text, text, bigint, text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_bachs_subscription_state(text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_billing_cancellation_requested(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.create_billing_payment_intent(uuid, uuid, text, text, text, bigint, text, integer, jsonb) to service_role;
grant execute on function public.claim_billing_event(text, text, text, jsonb) to service_role;
grant execute on function public.finish_billing_event(text, text, text, text) to service_role;
grant execute on function public.apply_bachs_payg_success(text, uuid, text, text, bigint, text) to service_role;
grant execute on function public.apply_bachs_subscription_cycle(text, uuid, text, text, text, bigint, text, text, timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function public.apply_bachs_subscription_state(text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz) to service_role;
grant execute on function public.mark_billing_cancellation_requested(uuid, uuid, timestamptz) to service_role;
