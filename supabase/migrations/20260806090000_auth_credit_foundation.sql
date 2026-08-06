create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  free_balance integer not null default 0 check (free_balance >= 0),
  subscription_balance integer not null default 0 check (subscription_balance >= 0),
  purchased_balance integer not null default 0 check (purchased_balance >= 0),
  subscription_period_key text,
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  -- Retain the pseudonymous owner ID for audit after an Auth account is deleted.
  user_id uuid not null,
  amount integer not null check (amount <> 0),
  bucket text not null check (bucket in ('free', 'subscription', 'purchased')),
  type text not null check (type in ('grant', 'reserve', 'spend', 'refund', 'expire', 'adjustment')),
  feature text not null check (feature in ('signup', 'mentor', 'ai_quiz', 'subscription', 'payg', 'admin')),
  reference text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger credit_wallets_set_updated_at
before update on public.credit_wallets
for each row execute function public.set_updated_at();

create or replace function public.reject_credit_transaction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'credit transactions are immutable';
end;
$$;

create trigger credit_transactions_are_immutable
before update or delete or truncate on public.credit_transactions
for each statement execute function public.reject_credit_transaction_mutation();

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
    user_id,
    user_email,
    coalesce(user_metadata ->> 'full_name', user_metadata ->> 'name'),
    user_metadata ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.credit_wallets (user_id, free_balance)
  values (user_id, 0)
  on conflict (user_id) do nothing;

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
      user_id,
      20,
      'free',
      'grant',
      'signup',
      user_id::text,
      'signup:' || user_id::text,
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.provision_user(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

select public.provision_user(id, email, raw_user_meta_data)
from auth.users;

alter table public.profiles enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy credit_wallets_select_own
on public.credit_wallets
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy credit_transactions_select_own
on public.credit_transactions
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.credit_wallets from anon, authenticated;
revoke all on table public.credit_transactions from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.credit_wallets to authenticated;
grant select on table public.credit_transactions to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.reject_credit_transaction_mutation() from public, anon, authenticated;
revoke all on function public.provision_user(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
