create or replace function public.provision_user(
  user_id uuid,
  user_email text,
  user_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_inserted boolean;
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    provision_user.user_id,
    provision_user.user_email,
    coalesce(provision_user.user_metadata ->> 'full_name', provision_user.user_metadata ->> 'name'),
    provision_user.user_metadata ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.credit_wallets (user_id, free_balance)
  values (provision_user.user_id, 0)
  on conflict on constraint credit_wallets_pkey do nothing;

  with inserted as (
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
    values (
      provision_user.user_id,
      20,
      'free',
      'grant',
      'signup',
      provision_user.user_id::text,
      'signup:' || provision_user.user_id::text,
      jsonb_build_object('source', 'user_provisioning')
    )
    on conflict (idempotency_key) do nothing
    returning true
  )
  select coalesce(bool_or(true), false) into transaction_inserted from inserted;

  if transaction_inserted then
    update public.credit_wallets
    set free_balance = free_balance + 20
    where credit_wallets.user_id = provision_user.user_id;
  end if;
end;
$$;

revoke all on function public.provision_user(uuid, text, jsonb) from public, anon, authenticated;
