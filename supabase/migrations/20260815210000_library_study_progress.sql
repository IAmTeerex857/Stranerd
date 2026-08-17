create table public.library_study_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  set_version integer not null check (set_version > 0),
  output_type text not null check (output_type in ('flashcards', 'practice')),
  attempt_id uuid not null,
  reset_at timestamptz not null,
  card_order uuid[], order_at timestamptz,
  current_index integer not null check (current_index >= 0), index_at timestamptz not null,
  side text check (side in ('question', 'answer')), side_at timestamptz,
  submitted boolean, submitted_at timestamptz,
  reviewing boolean, reviewing_at timestamptz,
  score integer check (score is null or score >= 0), score_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, set_id, set_version),
  foreign key (set_id, user_id) references public.library_sets(id, creator_user_id) on delete cascade,
  check ((output_type = 'flashcards' and card_order is not null and order_at is not null and side is not null and side_at is not null and submitted is null and reviewing is null)
    or (output_type = 'practice' and card_order is null and side is null and submitted is not null and submitted_at is not null and reviewing is not null and reviewing_at is not null and score_at is not null))
);

create table public.library_study_item_progress (
  user_id uuid not null,
  set_id uuid not null,
  set_version integer not null,
  item_id uuid not null references public.library_items(id) on delete cascade,
  attempt_id uuid not null,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  state_at timestamptz not null,
  primary key (user_id, set_id, set_version, item_id),
  foreign key (user_id, set_id, set_version) references public.library_study_attempts(user_id, set_id, set_version) on delete cascade
);

alter table public.library_study_attempts enable row level security;
alter table public.library_study_item_progress enable row level security;
create policy library_study_attempts_own on public.library_study_attempts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy library_study_items_own on public.library_study_item_progress for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.library_study_attempts, public.library_study_item_progress from anon, authenticated;
grant select on public.library_study_attempts, public.library_study_item_progress to authenticated;
grant select, insert, update, delete on public.library_study_attempts, public.library_study_item_progress to service_role;

create or replace function public.merge_library_study_progress(p_user_id uuid, p_progress jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  set_row public.library_sets%rowtype;
  existing public.library_study_attempts%rowtype;
  incoming_attempt uuid := (p_progress->>'attemptId')::uuid;
  incoming_reset timestamptz := (p_progress->>'resetAt')::timestamptz;
  item record;
  replace_attempt boolean := false;
begin
  perform set_config('lock_timeout', '3s', true);
  select * into set_row from public.library_sets where id = (p_progress->>'setId')::uuid for update;
  if not found or set_row.creator_user_id <> p_user_id or set_row.status <> 'ready' or set_row.version <> (p_progress->>'setVersion')::integer or set_row.output_type <> p_progress->>'kind' then
    raise exception 'ready library set version not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_progress->'items') <> 'object' or exists (
    select 1 from jsonb_object_keys(p_progress->'items') key
    where not exists (select 1 from public.library_items i where i.id = key::uuid and i.set_id = set_row.id and i.generation_version <= set_row.version)
  ) then raise exception 'invalid library progress items' using errcode = '22023'; end if;

  select * into existing from public.library_study_attempts where user_id = p_user_id and set_id = set_row.id and set_version = set_row.version for update;
  replace_attempt := not found or incoming_reset > existing.reset_at or (incoming_reset = existing.reset_at and incoming_attempt::text > existing.attempt_id::text);
  if found and not replace_attempt and incoming_attempt <> existing.attempt_id then return; end if;
  if replace_attempt and existing.attempt_id is not null then delete from public.library_study_item_progress where user_id = p_user_id and set_id = set_row.id and set_version = set_row.version; end if;

  insert into public.library_study_attempts(user_id,set_id,set_version,output_type,attempt_id,reset_at,card_order,order_at,current_index,index_at,side,side_at,submitted,submitted_at,reviewing,reviewing_at,score,score_at,updated_at)
  values (p_user_id,set_row.id,set_row.version,set_row.output_type,incoming_attempt,incoming_reset,
    case when set_row.output_type='flashcards' then array(select jsonb_array_elements_text(p_progress->'order'->'value'))::uuid[] end,
    case when set_row.output_type='flashcards' then (p_progress->'order'->>'updatedAt')::timestamptz end,
    (p_progress->'index'->>'value')::integer,(p_progress->'index'->>'updatedAt')::timestamptz,
    p_progress->'side'->>'value',case when set_row.output_type='flashcards' then (p_progress->'side'->>'updatedAt')::timestamptz end,
    case when set_row.output_type='practice' then (p_progress->'submitted'->>'value')::boolean end,case when set_row.output_type='practice' then (p_progress->'submitted'->>'updatedAt')::timestamptz end,
    case when set_row.output_type='practice' then (p_progress->'reviewing'->>'value')::boolean end,case when set_row.output_type='practice' then (p_progress->'reviewing'->>'updatedAt')::timestamptz end,
    case when set_row.output_type='practice' and p_progress->'score'->'value' <> 'null'::jsonb then (p_progress->'score'->>'value')::integer end,case when set_row.output_type='practice' then (p_progress->'score'->>'updatedAt')::timestamptz end,clock_timestamp())
  on conflict (user_id,set_id,set_version) do update set
    attempt_id=excluded.attempt_id, reset_at=case when replace_attempt then excluded.reset_at else library_study_attempts.reset_at end,
    card_order=case when replace_attempt or excluded.order_at > library_study_attempts.order_at or (excluded.order_at=library_study_attempts.order_at and excluded.card_order::text > library_study_attempts.card_order::text) then excluded.card_order else library_study_attempts.card_order end,
    order_at=case when replace_attempt then excluded.order_at else greatest(library_study_attempts.order_at,excluded.order_at) end,
    current_index=case when replace_attempt or excluded.index_at > library_study_attempts.index_at or (excluded.index_at=library_study_attempts.index_at and excluded.current_index > library_study_attempts.current_index) then excluded.current_index else library_study_attempts.current_index end,
    index_at=case when replace_attempt then excluded.index_at else greatest(library_study_attempts.index_at,excluded.index_at) end,
    side=case when replace_attempt or excluded.side_at > library_study_attempts.side_at or (excluded.side_at=library_study_attempts.side_at and excluded.side > library_study_attempts.side) then excluded.side else library_study_attempts.side end,
    side_at=case when replace_attempt then excluded.side_at else greatest(library_study_attempts.side_at,excluded.side_at) end,
    submitted=case when replace_attempt or excluded.submitted_at > library_study_attempts.submitted_at or (excluded.submitted_at=library_study_attempts.submitted_at and excluded.submitted::int > library_study_attempts.submitted::int) then excluded.submitted else library_study_attempts.submitted end,
    submitted_at=case when replace_attempt then excluded.submitted_at else greatest(library_study_attempts.submitted_at,excluded.submitted_at) end,
    reviewing=case when replace_attempt or excluded.reviewing_at > library_study_attempts.reviewing_at or (excluded.reviewing_at=library_study_attempts.reviewing_at and excluded.reviewing::int > library_study_attempts.reviewing::int) then excluded.reviewing else library_study_attempts.reviewing end,
    reviewing_at=case when replace_attempt then excluded.reviewing_at else greatest(library_study_attempts.reviewing_at,excluded.reviewing_at) end,
    score=case when replace_attempt or excluded.score_at > library_study_attempts.score_at or (excluded.score_at=library_study_attempts.score_at and coalesce(excluded.score,-1) > coalesce(library_study_attempts.score,-1)) then excluded.score else library_study_attempts.score end,
    score_at=case when replace_attempt then excluded.score_at else greatest(library_study_attempts.score_at,excluded.score_at) end, updated_at=clock_timestamp();

  for item in select key::uuid item_id, value state from jsonb_each(p_progress->'items') loop
    insert into public.library_study_item_progress(user_id,set_id,set_version,item_id,attempt_id,state,state_at)
    values(p_user_id,set_row.id,set_row.version,item.item_id,incoming_attempt,item.state,(item.state->>'updatedAt')::timestamptz)
    on conflict (user_id,set_id,set_version,item_id) do update set attempt_id=excluded.attempt_id,state=excluded.state,state_at=excluded.state_at
    where library_study_item_progress.attempt_id=excluded.attempt_id and (excluded.state_at > library_study_item_progress.state_at or (excluded.state_at=library_study_item_progress.state_at and excluded.state::text > library_study_item_progress.state::text));
  end loop;
end;
$$;

revoke all on function public.merge_library_study_progress(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.merge_library_study_progress(uuid,jsonb) to service_role;
