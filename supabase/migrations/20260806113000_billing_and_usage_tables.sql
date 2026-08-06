create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  provider text not null default 'spotflow' check (provider = 'spotflow'),
  provider_subscription_id text not null unique,
  provider_plan_id text not null,
  status text not null check (status in ('pending', 'active', 'past_due', 'cancelled', 'completed')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_updated_at timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create index subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at desc);

create unique index subscriptions_one_live_per_user_idx
  on public.subscriptions (user_id)
  where status in ('pending', 'active', 'past_due');

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  provider_reference text not null unique,
  product_type text not null check (product_type in ('subscription', 'payg_100')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'NGN'),
  credits integer not null check (
    (product_type = 'subscription' and credits = 500)
    or (product_type = 'payg_100' and credits = 100)
  ),
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed', 'cancelled', 'refunded')),
  checkout_url text,
  provider_payment_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_intents_user_created_idx
  on public.payment_intents (user_id, created_at desc);

create unique index payment_intents_provider_payment_idx
  on public.payment_intents (provider_payment_id)
  where provider_payment_id is not null;

create table public.webhook_events (
  provider text not null check (provider = 'spotflow'),
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'ignored', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, event_id)
);

create index webhook_events_status_received_idx
  on public.webhook_events (status, received_at);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('mentor', 'ai_quiz')),
  request_id text not null unique,
  reservation_id uuid not null,
  provider text not null,
  model text,
  status text not null default 'requested' check (status in ('requested', 'successful', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.credit_reservations
  add constraint credit_reservations_id_user_unique unique (id, user_id);

alter table public.ai_usage
  add constraint ai_usage_reservation_owner_fk
  foreign key (reservation_id, user_id)
  references public.credit_reservations (id, user_id)
  on delete cascade;

create index ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger payment_intents_set_updated_at
before update on public.payment_intents
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.payment_intents enable row level security;
alter table public.webhook_events enable row level security;
alter table public.ai_usage enable row level security;

create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy payment_intents_select_own
on public.payment_intents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy ai_usage_select_own
on public.ai_usage
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.payment_intents from anon, authenticated;
revoke all on table public.webhook_events from anon, authenticated;
revoke all on table public.ai_usage from anon, authenticated;

grant select on table public.subscriptions to authenticated;
grant select on table public.payment_intents to authenticated;
grant select on table public.ai_usage to authenticated;

revoke all on table public.subscriptions from service_role;
revoke all on table public.payment_intents from service_role;
revoke all on table public.webhook_events from service_role;
revoke all on table public.ai_usage from service_role;

grant select, insert, update on table public.subscriptions to service_role;
grant select, insert, update on table public.payment_intents to service_role;
grant select, insert on table public.webhook_events to service_role;
grant update (status, error, processed_at) on table public.webhook_events to service_role;
grant select, insert, update on table public.ai_usage to service_role;
