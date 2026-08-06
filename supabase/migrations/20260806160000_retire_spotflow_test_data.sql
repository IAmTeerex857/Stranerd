do $$
declare
  wallet record;
begin
  if exists (select 1 from public.credit_reservations where status = 'reserved') then
    raise exception 'cannot retire test billing data while credit reservations are active';
  end if;

  for wallet in
    select user_id, subscription_balance, purchased_balance
    from public.credit_wallets
    where subscription_balance > 0 or purchased_balance > 0
    for update
  loop
    if wallet.subscription_balance > 0 then
      insert into public.credit_transactions (
        user_id,
        amount,
        bucket,
        type,
        feature,
        reference,
        idempotency_key,
        metadata
      ) values (
        wallet.user_id,
        -wallet.subscription_balance,
        'subscription',
        'adjustment',
        'admin',
        'spotflow-test-retirement',
        'spotflow-test-retirement:subscription:' || wallet.user_id::text,
        jsonb_build_object('reason', 'Spotflow live-mode migration')
      ) on conflict (idempotency_key) do nothing;
    end if;

    if wallet.purchased_balance > 0 then
      insert into public.credit_transactions (
        user_id,
        amount,
        bucket,
        type,
        feature,
        reference,
        idempotency_key,
        metadata
      ) values (
        wallet.user_id,
        -wallet.purchased_balance,
        'purchased',
        'adjustment',
        'admin',
        'spotflow-test-retirement',
        'spotflow-test-retirement:purchased:' || wallet.user_id::text,
        jsonb_build_object('reason', 'Spotflow live-mode migration')
      ) on conflict (idempotency_key) do nothing;
    end if;
  end loop;

  update public.credit_wallets
  set subscription_balance = 0,
      purchased_balance = 0,
      subscription_period_key = null
  where subscription_balance > 0 or purchased_balance > 0 or subscription_period_key is not null;

  update public.subscriptions
  set status = 'cancelled',
      cancel_at_period_end = true,
      metadata = metadata || jsonb_build_object('retiredTestData', true, 'retiredAt', clock_timestamp())
  where status <> 'cancelled' or not cancel_at_period_end or metadata ->> 'retiredTestData' is distinct from 'true';

  update public.payment_intents
  set status = case when status = 'pending' then 'cancelled' else status end,
      metadata = metadata || jsonb_build_object('retiredTestData', true, 'retiredAt', clock_timestamp())
  where lower(coalesce(metadata ->> 'mode', 'test')) = 'test'
    and metadata ->> 'retiredTestData' is distinct from 'true';
end;
$$;
