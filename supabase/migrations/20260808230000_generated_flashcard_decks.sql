alter table public.credit_reservations drop constraint credit_reservations_feature_check;
alter table public.credit_reservations add constraint credit_reservations_feature_check check (feature in ('mentor', 'ai_quiz', 'ai_flashcards'));
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check check (feature in ('mentor', 'ai_quiz', 'ai_flashcards'));
alter table public.credit_transactions drop constraint credit_transactions_feature_check;
alter table public.credit_transactions add constraint credit_transactions_feature_check check (feature in ('signup', 'mentor', 'ai_quiz', 'ai_flashcards', 'flashcard_unlock', 'subscription', 'payg', 'admin'));

create table public.flashcard_decks (
  id uuid primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  model_id text not null,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 500),
  visibility text not null check (visibility in ('private', 'public')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  card_count integer not null default 12 check (card_count = 12),
  generation_cost integer not null default 5 check (generation_cost = 5),
  unlock_cost integer not null default 5 check (unlock_cost = 5),
  generation_request_id uuid not null unique,
  reservation_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (reservation_id, owner_user_id) references public.credit_reservations (id, user_id) on delete cascade
);

create table public.flashcard_deck_content (
  deck_id uuid primary key references public.flashcard_decks (id) on delete cascade,
  content_version text not null,
  cards jsonb not null check (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) = 12),
  created_at timestamptz not null default now()
);

create table public.flashcard_deck_unlocks (
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null unique,
  cost integer not null default 5 check (cost = 5),
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);

create index flashcard_decks_owner_created_idx on public.flashcard_decks (owner_user_id, created_at desc);
create index flashcard_decks_public_created_idx on public.flashcard_decks (created_at desc) where visibility = 'public' and status = 'ready';
create trigger flashcard_decks_set_updated_at before update on public.flashcard_decks for each row execute function public.set_updated_at();

alter table public.flashcard_decks enable row level security;
alter table public.flashcard_deck_content enable row level security;
alter table public.flashcard_deck_unlocks enable row level security;

create policy flashcard_decks_readable on public.flashcard_decks for select to authenticated
using (owner_user_id = (select auth.uid()) or (visibility = 'public' and status = 'ready'));

create policy flashcard_content_entitled on public.flashcard_deck_content for select to authenticated
using (exists (
  select 1 from public.flashcard_decks d
  where d.id = deck_id and d.status = 'ready' and (
    d.owner_user_id = (select auth.uid()) or exists (
      select 1 from public.flashcard_deck_unlocks u where u.deck_id = d.id and u.user_id = (select auth.uid())
    )
  )
));

create policy flashcard_unlocks_own on public.flashcard_deck_unlocks for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.flashcard_decks, public.flashcard_deck_content, public.flashcard_deck_unlocks from anon, authenticated;
grant select on public.flashcard_decks, public.flashcard_deck_content, public.flashcard_deck_unlocks to authenticated;
grant select, insert, update, delete on public.flashcard_decks, public.flashcard_deck_content, public.flashcard_deck_unlocks to service_role;

create or replace function public.reserve_flashcard_credits(p_user_id uuid, p_feature text, p_amount integer, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  wallet public.credit_wallets%rowtype;
  reservation public.credit_reservations%rowtype;
  free_reserved integer;
  subscription_reserved integer;
  purchased_reserved integer;
begin
  if p_feature <> 'ai_flashcards' or p_amount <> 5 then raise exception 'invalid flashcard generation price' using errcode = '22023'; end if;
  select * into reservation from public.credit_reservations where request_id = p_request_id;
  if found then
    if reservation.user_id <> p_user_id or reservation.feature <> p_feature or reservation.amount <> p_amount then raise exception 'request ID is already in use' using errcode = '23505'; end if;
    select * into wallet from public.credit_wallets where user_id = p_user_id;
    return jsonb_build_object('reservationId', reservation.id, 'requestId', reservation.request_id, 'status', reservation.status, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
  end if;
  select * into wallet from public.credit_wallets where user_id = p_user_id for update;
  if not found then raise exception 'credit wallet not found' using errcode = 'P0002'; end if;
  select * into reservation from public.credit_reservations where request_id = p_request_id;
  if found then
    if reservation.user_id <> p_user_id or reservation.feature <> p_feature or reservation.amount <> p_amount then raise exception 'request ID is already in use' using errcode = '23505'; end if;
    return jsonb_build_object('reservationId', reservation.id, 'requestId', reservation.request_id, 'status', reservation.status, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
  end if;
  if wallet.free_balance::bigint + wallet.subscription_balance + wallet.purchased_balance < 5 then raise exception 'insufficient credits' using errcode = 'P0001'; end if;
  free_reserved := least(wallet.free_balance, 5);
  subscription_reserved := least(wallet.subscription_balance, 5 - free_reserved);
  purchased_reserved := 5 - free_reserved - subscription_reserved;
  update public.credit_wallets set free_balance = free_balance - free_reserved, subscription_balance = subscription_balance - subscription_reserved, purchased_balance = purchased_balance - purchased_reserved where user_id = p_user_id returning * into wallet;
  insert into public.credit_reservations (user_id, feature, amount, request_id, bucket_breakdown, subscription_period_key, expires_at)
  values (p_user_id, 'ai_flashcards', 5, p_request_id, jsonb_build_object('free', free_reserved, 'subscription', subscription_reserved, 'purchased', purchased_reserved), wallet.subscription_period_key, clock_timestamp() + interval '10 minutes') returning * into reservation;
  insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
  select p_user_id, -entry.amount, entry.bucket, 'reserve', 'ai_flashcards', reservation.id::text, 'reserve:' || p_request_id || ':' || entry.bucket, jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id)
  from (values ('free', free_reserved), ('subscription', subscription_reserved), ('purchased', purchased_reserved)) entry(bucket, amount) where entry.amount > 0;
  return jsonb_build_object('reservationId', reservation.id, 'requestId', reservation.request_id, 'status', reservation.status, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
end; $$;

create or replace function public.stage_generated_flashcard_deck(p_deck_id uuid, p_user_id uuid, p_request_id uuid, p_reservation_id uuid, p_model_id text, p_title text, p_description text, p_visibility text, p_content_version text, p_cards jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing_id uuid;
begin
  select id into existing_id from public.flashcard_decks where generation_request_id = p_request_id;
  if found then return existing_id; end if;
  if p_visibility not in ('private', 'public') or jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) <> 12 then raise exception 'invalid generated deck' using errcode = '22023'; end if;
  if not exists (select 1 from public.credit_reservations where id = p_reservation_id and user_id = p_user_id and request_id = p_request_id::text and feature = 'ai_flashcards' and amount = 5 and status = 'reserved') then raise exception 'valid reservation required' using errcode = 'P0001'; end if;
  insert into public.flashcard_decks (id, owner_user_id, model_id, title, description, visibility, generation_request_id, reservation_id) values (p_deck_id, p_user_id, p_model_id, p_title, p_description, p_visibility, p_request_id, p_reservation_id);
  insert into public.flashcard_deck_content (deck_id, content_version, cards) values (p_deck_id, p_content_version, p_cards);
  return p_deck_id;
end; $$;

create or replace function public.activate_generated_flashcard_deck()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.feature = 'ai_flashcards' and old.status = 'reserved' and new.status = 'spent' then
    if not exists (select 1 from public.flashcard_decks d join public.flashcard_deck_content c on c.deck_id = d.id where d.reservation_id = new.id and jsonb_array_length(c.cards) = 12) then raise exception 'generated deck content missing'; end if;
    update public.flashcard_decks set status = 'ready' where reservation_id = new.id;
  elsif new.feature = 'ai_flashcards' and new.status in ('refunded', 'expired') then
    update public.flashcard_decks set status = 'failed' where reservation_id = new.id and status = 'pending';
  end if;
  return new;
end; $$;

create trigger credit_reservation_activates_flashcard after update of status on public.credit_reservations for each row execute function public.activate_generated_flashcard_deck();

create or replace function public.unlock_generated_flashcard_deck(p_user_id uuid, p_deck_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare deck public.flashcard_decks%rowtype; wallet public.credit_wallets%rowtype; free_spent integer; subscription_spent integer; purchased_spent integer;
begin
  select * into deck from public.flashcard_decks where id = p_deck_id and status = 'ready' and visibility = 'public' for share;
  if not found then raise exception 'deck not found' using errcode = 'P0002'; end if;
  if deck.owner_user_id = p_user_id then select * into wallet from public.credit_wallets where user_id = p_user_id; return jsonb_build_object('deckId', p_deck_id, 'alreadyUnlocked', true, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance); end if;
  if exists (select 1 from public.flashcard_deck_unlocks where deck_id = p_deck_id and user_id = p_user_id) then select * into wallet from public.credit_wallets where user_id = p_user_id; return jsonb_build_object('deckId', p_deck_id, 'alreadyUnlocked', true, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance); end if;
  select * into wallet from public.credit_wallets where user_id = p_user_id for update;
  if wallet.free_balance::bigint + wallet.subscription_balance + wallet.purchased_balance < 5 then raise exception 'insufficient credits' using errcode = 'P0001'; end if;
  if exists (select 1 from public.flashcard_deck_unlocks where deck_id = p_deck_id and user_id = p_user_id) then return jsonb_build_object('deckId', p_deck_id, 'alreadyUnlocked', true, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance); end if;
  free_spent := least(wallet.free_balance, 5); subscription_spent := least(wallet.subscription_balance, 5 - free_spent); purchased_spent := 5 - free_spent - subscription_spent;
  update public.credit_wallets set free_balance = free_balance - free_spent, subscription_balance = subscription_balance - subscription_spent, purchased_balance = purchased_balance - purchased_spent where user_id = p_user_id returning * into wallet;
  insert into public.flashcard_deck_unlocks (deck_id, user_id, request_id) values (p_deck_id, p_user_id, p_request_id) on conflict (deck_id, user_id) do nothing;
  insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
  select p_user_id, -entry.amount, entry.bucket, 'spend', 'flashcard_unlock', p_deck_id::text, 'flashcard-unlock:' || p_user_id || ':' || p_deck_id || ':' || entry.bucket, jsonb_build_object('deckId', p_deck_id, 'requestId', p_request_id)
  from (values ('free', free_spent), ('subscription', subscription_spent), ('purchased', purchased_spent)) entry(bucket, amount) where entry.amount > 0;
  return jsonb_build_object('deckId', p_deck_id, 'alreadyUnlocked', false, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
end; $$;

revoke all on function public.reserve_flashcard_credits(uuid, text, integer, text), public.stage_generated_flashcard_deck(uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb), public.unlock_generated_flashcard_deck(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_flashcard_credits(uuid, text, integer, text), public.stage_generated_flashcard_deck(uuid, uuid, uuid, uuid, text, text, text, text, text, jsonb), public.unlock_generated_flashcard_deck(uuid, uuid, uuid) to service_role;
