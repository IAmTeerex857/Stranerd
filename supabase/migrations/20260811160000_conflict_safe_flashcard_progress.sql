alter table public.flashcard_progress add column content_version text;
alter table public.flashcard_progress add column last_review_id uuid not null default '00000000-0000-0000-0000-000000000000';

update public.flashcard_progress p set content_version = coalesce(
  (select c.content_version from public.flashcard_deck_content c where c.deck_id::text = p.deck_id),
  (select r.content_hash from public.material_releases r where 'materials:' || r.id::text = p.deck_id),
  case when p.deck_id like '%-foundations' then '3' else 'legacy' end
);

alter table public.flashcard_progress alter column content_version set not null;
alter table public.flashcard_progress drop constraint flashcard_progress_pkey;
alter table public.flashcard_progress add primary key (user_id, deck_id, content_version, card_id);

create table public.flashcard_review_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null check (char_length(deck_id) between 1 and 200),
  content_version text not null check (char_length(content_version) between 1 and 200),
  card_id text not null check (char_length(card_id) between 1 and 300),
  grade text not null check (grade in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null check (isfinite(reviewed_at)),
  received_at timestamptz not null default clock_timestamp()
);

alter table public.flashcard_review_events enable row level security;
revoke all on public.flashcard_review_events from public, anon, authenticated;
revoke insert, update on public.flashcard_progress from authenticated;

create or replace function public.record_flashcard_review(p_review_id uuid, p_deck_id text, p_content_version text, p_card_id text, p_grade text, p_reviewed_at timestamptz)
returns public.flashcard_progress language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  saved_event public.flashcard_review_events%rowtype;
  saved_progress public.flashcard_progress%rowtype;
  inserted_count integer;
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_review_id is null or char_length(p_deck_id) not between 1 and 200 or char_length(p_content_version) not between 1 and 200 or char_length(p_card_id) not between 1 and 300 or p_grade not in ('again', 'hard', 'good', 'easy') or not isfinite(p_reviewed_at) then raise exception 'invalid flashcard review' using errcode = '22023'; end if;

  insert into public.flashcard_review_events (id, user_id, deck_id, content_version, card_id, grade, reviewed_at)
  values (p_review_id, current_user_id, p_deck_id, p_content_version, p_card_id, p_grade, p_reviewed_at)
  on conflict (id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    select * into saved_event from public.flashcard_review_events where id = p_review_id;
    if saved_event.user_id is distinct from current_user_id or saved_event.deck_id is distinct from p_deck_id or saved_event.content_version is distinct from p_content_version or saved_event.card_id is distinct from p_card_id or saved_event.grade is distinct from p_grade or saved_event.reviewed_at is distinct from p_reviewed_at then raise exception 'review ID is already in use' using errcode = '23505'; end if;
  else
    insert into public.flashcard_progress (user_id, deck_id, content_version, card_id, grade, review_count, updated_at, last_review_id)
    values (current_user_id, p_deck_id, p_content_version, p_card_id, p_grade, 1, p_reviewed_at, p_review_id)
    on conflict (user_id, deck_id, content_version, card_id) do update set
      grade = case when (excluded.updated_at, excluded.last_review_id) > (public.flashcard_progress.updated_at, public.flashcard_progress.last_review_id) then excluded.grade else public.flashcard_progress.grade end,
      review_count = public.flashcard_progress.review_count + 1,
      updated_at = case when (excluded.updated_at, excluded.last_review_id) > (public.flashcard_progress.updated_at, public.flashcard_progress.last_review_id) then excluded.updated_at else public.flashcard_progress.updated_at end,
      last_review_id = case when (excluded.updated_at, excluded.last_review_id) > (public.flashcard_progress.updated_at, public.flashcard_progress.last_review_id) then excluded.last_review_id else public.flashcard_progress.last_review_id end;
  end if;

  select * into saved_progress from public.flashcard_progress where user_id = current_user_id and deck_id = p_deck_id and content_version = p_content_version and card_id = p_card_id;
  return saved_progress;
end; $$;

create or replace function public.merge_flashcard_progress_floor(p_deck_id text, p_content_version text, p_card_id text, p_grade text, p_review_count integer, p_updated_at timestamptz, p_last_review_id uuid)
returns public.flashcard_progress language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  saved_progress public.flashcard_progress%rowtype;
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if char_length(p_deck_id) not between 1 and 200 or char_length(p_content_version) not between 1 and 200 or char_length(p_card_id) not between 1 and 300 or p_grade not in ('again', 'hard', 'good', 'easy') or p_review_count <= 0 or not isfinite(p_updated_at) or p_last_review_id is null then raise exception 'invalid flashcard progress' using errcode = '22023'; end if;

  insert into public.flashcard_progress (user_id, deck_id, content_version, card_id, grade, review_count, updated_at, last_review_id)
  values (current_user_id, p_deck_id, p_content_version, p_card_id, p_grade, p_review_count, p_updated_at, p_last_review_id)
  on conflict (user_id, deck_id, content_version, card_id) do update set
    grade = case when (excluded.updated_at, excluded.last_review_id) > (public.flashcard_progress.updated_at, public.flashcard_progress.last_review_id) then excluded.grade else public.flashcard_progress.grade end,
    review_count = greatest(public.flashcard_progress.review_count, excluded.review_count),
    updated_at = case when (excluded.updated_at, excluded.last_review_id) > (public.flashcard_progress.updated_at, public.flashcard_progress.last_review_id) then excluded.updated_at else public.flashcard_progress.updated_at end,
    last_review_id = case when (excluded.updated_at, excluded.last_review_id) > (public.flashcard_progress.updated_at, public.flashcard_progress.last_review_id) then excluded.last_review_id else public.flashcard_progress.last_review_id end
  returning * into saved_progress;
  return saved_progress;
end; $$;

revoke all on function public.record_flashcard_review(uuid, text, text, text, text, timestamptz), public.merge_flashcard_progress_floor(text, text, text, text, integer, timestamptz, uuid) from public, anon;
grant execute on function public.record_flashcard_review(uuid, text, text, text, text, timestamptz), public.merge_flashcard_progress_floor(text, text, text, text, integer, timestamptz, uuid) to authenticated;
