alter table public.credit_reservations drop constraint credit_reservations_feature_check;
alter table public.credit_reservations add constraint credit_reservations_feature_check check (feature in ('mentor', 'ai_quiz', 'ai_flashcards', 'voice_session'));
alter table public.credit_transactions drop constraint credit_transactions_feature_check;
alter table public.credit_transactions add constraint credit_transactions_feature_check check (feature in ('signup', 'mentor', 'ai_quiz', 'ai_flashcards', 'flashcard_unlock', 'voice_session', 'subscription', 'payg', 'admin'));
alter table public.flashcard_decks drop constraint flashcard_decks_status_check;
alter table public.flashcard_decks add constraint flashcard_decks_status_check check (status in ('pending', 'ready', 'failed', 'unlisted'));

create table public.voice_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null unique, reservation_id uuid not null unique references public.credit_reservations (id) on delete cascade,
  provider_session_id text, mode text not null check (mode in ('mentor', 'lab', 'assessment')),
  started_at timestamptz not null default now(), ends_at timestamptz not null,
  status text not null default 'issued' check (status in ('issued', 'ended', 'failed'))
);

create table public.flashcard_progress (
  user_id uuid not null references auth.users (id) on delete cascade, deck_id text not null, card_id text not null,
  grade text not null check (grade in ('again', 'hard', 'good', 'easy')), review_count integer not null check (review_count > 0),
  updated_at timestamptz not null default now(), primary key (user_id, deck_id, card_id)
);

create table public.flashcard_deck_reports (
  id uuid primary key default gen_random_uuid(), deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('inaccurate', 'unsafe', 'spam', 'other')), details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')), created_at timestamptz not null default now(),
  unique (deck_id, reporter_user_id)
);

alter table public.voice_sessions enable row level security; alter table public.flashcard_progress enable row level security; alter table public.flashcard_deck_reports enable row level security;
create policy voice_sessions_own on public.voice_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy flashcard_progress_own on public.flashcard_progress for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy flashcard_reports_read_own on public.flashcard_deck_reports for select to authenticated using (reporter_user_id = (select auth.uid()));
create policy flashcard_reports_insert_own on public.flashcard_deck_reports for insert to authenticated with check (reporter_user_id = (select auth.uid()) and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.visibility = 'public' and d.status = 'ready' and d.owner_user_id <> (select auth.uid())));
revoke all on public.voice_sessions, public.flashcard_progress, public.flashcard_deck_reports from anon, authenticated;
grant select on public.voice_sessions to authenticated; grant select, insert, update on public.flashcard_progress to authenticated; grant select, insert on public.flashcard_deck_reports to authenticated;
grant select, insert, update on public.voice_sessions, public.flashcard_progress, public.flashcard_deck_reports to service_role;

create or replace function public.reserve_voice_session_credits(p_user_id uuid, p_amount integer, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare wallet public.credit_wallets%rowtype; reservation public.credit_reservations%rowtype; f integer; s integer; p integer;
begin
  if p_amount <> 10 then raise exception 'invalid voice session price' using errcode = '22023'; end if;
  select * into reservation from public.credit_reservations where request_id = p_request_id;
  if found then
    if reservation.user_id <> p_user_id or reservation.feature <> 'voice_session' or reservation.amount <> 10 then raise exception 'request ID is already in use' using errcode = '23505'; end if;
    select * into wallet from public.credit_wallets where user_id = p_user_id;
    return jsonb_build_object('reservationId', reservation.id, 'status', reservation.status, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
  end if;
  select * into wallet from public.credit_wallets where user_id = p_user_id for update;
  if wallet.free_balance::bigint + wallet.subscription_balance + wallet.purchased_balance < 10 then raise exception 'insufficient credits' using errcode = 'P0001'; end if;
  f := least(wallet.free_balance, 10); s := least(wallet.subscription_balance, 10 - f); p := 10 - f - s;
  update public.credit_wallets set free_balance = free_balance - f, subscription_balance = subscription_balance - s, purchased_balance = purchased_balance - p where user_id = p_user_id returning * into wallet;
  insert into public.credit_reservations (user_id, feature, amount, request_id, bucket_breakdown, subscription_period_key, expires_at) values (p_user_id, 'voice_session', 10, p_request_id, jsonb_build_object('free', f, 'subscription', s, 'purchased', p), wallet.subscription_period_key, clock_timestamp() + interval '10 minutes') returning * into reservation;
  insert into public.credit_transactions (user_id, amount, bucket, type, feature, reference, idempotency_key, metadata)
  select p_user_id, -x.amount, x.bucket, 'reserve', 'voice_session', reservation.id::text, 'reserve:' || p_request_id || ':' || x.bucket, jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id)
  from (values ('free', f), ('subscription', s), ('purchased', p)) x(bucket, amount) where x.amount > 0;
  return jsonb_build_object('reservationId', reservation.id, 'status', reservation.status, 'freeBalance', wallet.free_balance, 'subscriptionBalance', wallet.subscription_balance, 'purchasedBalance', wallet.purchased_balance);
end; $$;

revoke all on function public.reserve_voice_session_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.reserve_voice_session_credits(uuid, integer, text) to service_role;
