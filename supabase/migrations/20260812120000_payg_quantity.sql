alter table public.payment_intents drop constraint payment_intents_credits_check;
alter table public.payment_intents add constraint payment_intents_credits_check check (
  (product_type = 'subscription' and credits = 500)
  or (product_type = 'payg_100' and credits between 100 and 2000 and credits % 100 = 0)
) not valid;
alter table public.payment_intents validate constraint payment_intents_credits_check;

alter table public.payment_intents drop constraint payment_intents_catalog_amount_check;
alter table public.payment_intents add constraint payment_intents_catalog_amount_check check (
  (provider = 'spotflow' and currency = 'NGN' and product_type = 'subscription' and amount_minor = 250000)
  or (provider = 'spotflow' and currency = 'NGN' and product_type = 'payg_100' and amount_minor = credits::bigint * 500)
  or (provider = 'bachs' and currency = 'USD' and product_type = 'subscription' and amount_minor = 500)
  or (provider = 'bachs' and currency = 'USD' and product_type = 'payg_100' and amount_minor = credits::bigint * 2)
) not valid;
alter table public.payment_intents validate constraint payment_intents_catalog_amount_check;

create or replace function public.create_spotflow_payment_intent(
  p_id uuid, p_user_id uuid, p_provider_reference text, p_product_type text,
  p_amount_minor bigint, p_credits integer, p_metadata jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  if p_product_type = 'subscription' and (
    exists (select 1 from public.subscriptions where user_id = p_user_id and status in ('pending', 'active', 'past_due'))
    or exists (select 1 from public.payment_intents where user_id = p_user_id and product_type = 'subscription' and status = 'pending')
  ) then raise exception 'subscription or checkout already exists' using errcode = '23505'; end if;
  if not (
    (p_product_type = 'subscription' and p_amount_minor = 250000 and p_credits = 500)
    or (p_product_type = 'payg_100' and p_credits between 100 and 2000 and p_credits % 100 = 0
      and p_amount_minor = p_credits::bigint * 500)
  ) then raise exception 'product does not match billing catalog' using errcode = '22023'; end if;
  insert into public.payment_intents (id, user_id, provider, provider_reference, product_type, amount_minor, currency, credits, status, metadata)
  values (p_id, p_user_id, 'spotflow', p_provider_reference, p_product_type, p_amount_minor, 'NGN', p_credits, 'pending', coalesce(p_metadata, '{}'::jsonb));
  return p_id;
end;
$$;

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
    or (p_provider = 'spotflow' and p_currency = 'NGN' and p_product_type = 'payg_100' and p_credits between 100 and 2000
      and p_credits % 100 = 0 and p_amount_minor = p_credits::bigint * 500)
    or (p_provider = 'bachs' and p_currency = 'USD' and p_product_type = 'subscription' and p_amount_minor = 500 and p_credits = 500)
    or (p_provider = 'bachs' and p_currency = 'USD' and p_product_type = 'payg_100' and p_credits between 100 and 2000
      and p_credits % 100 = 0 and p_amount_minor = p_credits::bigint * 2)
  ) then raise exception 'product does not match billing catalog' using errcode = '22023'; end if;
  insert into public.payment_intents (id, user_id, provider, provider_reference, product_type, amount_minor, currency, credits, status, metadata)
  values (p_id, p_user_id, p_provider, p_provider_reference, p_product_type, p_amount_minor, p_currency, p_credits, 'pending', coalesce(p_metadata, '{}'::jsonb));
  return p_id;
end;
$$;

create or replace function public.apply_spotflow_payg_success(
  p_event_id text, p_payment_intent_id uuid, p_provider_payment_id text,
  p_provider_reference text, p_provider_amount bigint, p_provider_currency text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event_row public.webhook_events%rowtype;
  intent public.payment_intents%rowtype;
  wallet public.credit_wallets%rowtype;
  granted boolean;
begin
  select * into event_row from public.webhook_events where provider = 'spotflow' and event_id = p_event_id for update;
  if not found or event_row.event_type <> 'payment_successful' or event_row.status <> 'processing' then
    raise exception 'webhook event is not a claimable PAYG success' using errcode = '22023';
  end if;
  select * into intent from public.payment_intents where id = p_payment_intent_id and provider = 'spotflow' for update;
  if not found or intent.user_id is null or intent.product_type <> 'payg_100'
    or intent.credits not between 100 and 2000 or intent.credits % 100 <> 0
    or intent.amount_minor <> intent.credits::bigint * 500 or intent.currency <> 'NGN'
    or intent.provider_reference is distinct from p_provider_reference
    or p_provider_amount is distinct from intent.amount_minor or p_provider_currency is distinct from intent.currency
    or coalesce(p_provider_payment_id, '') = '' or intent.status not in ('pending', 'failed', 'successful') then
    raise exception 'provider payment does not match PAYG intent' using errcode = '22023';
  end if;
  if intent.status = 'successful' then
    if intent.provider_payment_id is distinct from p_provider_payment_id then raise exception 'payment intent is already bound to another payment' using errcode = '22023'; end if;
    perform public.finish_spotflow_event(p_event_id, 'processed');
    return jsonb_build_object('status', 'processed', 'duplicate', true);
  end if;
  select * into wallet from public.credit_wallets where user_id = intent.user_id for update;
  if not found then raise exception 'credit wallet not found' using errcode = 'P0002'; end if;
  with inserted as (
    insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
    values (intent.user_id, intent.credits, 'purchased', 'grant', 'payg', p_provider_payment_id,
      'payg:' || p_provider_payment_id, jsonb_build_object('paymentIntentId', intent.id, 'providerReference', p_provider_reference))
    on conflict (idempotency_key) do nothing returning true
  ) select coalesce(bool_or(true), false) into granted from inserted;
  if granted then update public.credit_wallets set purchased_balance = purchased_balance + intent.credits where user_id = intent.user_id returning * into wallet; end if;
  update public.payment_intents set status = 'successful', provider_payment_id = p_provider_payment_id where id = intent.id;
  perform public.finish_spotflow_event(p_event_id, 'processed');
  return jsonb_build_object('status', 'processed', 'duplicate', not granted,
    'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
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
  if not found or intent.user_id is null or intent.product_type <> 'payg_100'
    or intent.credits not between 100 and 2000 or intent.credits % 100 <> 0
    or intent.amount_minor <> intent.credits::bigint * 2 or intent.currency <> 'USD'
    or intent.provider_reference is distinct from p_provider_reference
    or p_provider_amount_minor is distinct from intent.amount_minor or p_provider_currency is distinct from intent.currency
    or coalesce(p_provider_payment_id, '') = '' or intent.status not in ('pending', 'failed', 'successful') then
    raise exception 'Bachs collection does not match PAYG intent' using errcode = '22023';
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
    values (intent.user_id, intent.credits, 'purchased', 'grant', 'payg', p_provider_payment_id,
      'bachs:payg:' || p_provider_payment_id, jsonb_build_object('paymentIntentId', intent.id, 'provider', 'bachs'))
    on conflict (idempotency_key) do nothing returning true
  ) select coalesce(bool_or(true), false) into granted from inserted;
  if granted then update public.credit_wallets set purchased_balance = purchased_balance + intent.credits where user_id = intent.user_id returning * into wallet; end if;
  update public.payment_intents set status = 'successful', provider_payment_id = p_provider_payment_id where id = intent.id;
  perform public.finish_billing_event('bachs', p_event_id, 'processed');
  return jsonb_build_object('status', 'processed', 'duplicate', not granted);
end;
$$;

revoke all on function public.create_spotflow_payment_intent(uuid, uuid, text, text, bigint, integer, jsonb) from public, anon, authenticated;
revoke all on function public.create_billing_payment_intent(uuid, uuid, text, text, text, bigint, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.apply_spotflow_payg_success(text, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.apply_bachs_payg_success(text, uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.create_spotflow_payment_intent(uuid, uuid, text, text, bigint, integer, jsonb) to service_role;
grant execute on function public.create_billing_payment_intent(uuid, uuid, text, text, text, bigint, text, integer, jsonb) to service_role;
grant execute on function public.apply_spotflow_payg_success(text, uuid, text, text, bigint, text) to service_role;
grant execute on function public.apply_bachs_payg_success(text, uuid, text, text, bigint, text) to service_role;
