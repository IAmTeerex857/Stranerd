create unique index if not exists library_items_set_id_id_unique on public.library_items(set_id,id);
create index if not exists library_study_item_progress_item_idx on public.library_study_item_progress(set_id,item_id);

alter table public.library_study_item_progress
  add constraint library_study_item_set_integrity foreign key(set_id,item_id) references public.library_items(set_id,id) on delete cascade not valid;
alter table public.library_study_item_progress validate constraint library_study_item_set_integrity;

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
  perform set_config('lock_timeout','3s',true);
  if p_user_id is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into set_row from public.library_sets where id=(p_progress->>'setId')::uuid for update;
  if not found or set_row.creator_user_id<>p_user_id or set_row.status<>'ready' or set_row.version<>(p_progress->>'setVersion')::integer or set_row.output_type<>p_progress->>'kind' then raise exception 'ready library set version not found' using errcode='P0002'; end if;
  if incoming_reset > clock_timestamp()+interval '5 minutes' or jsonb_typeof(p_progress->'items')<>'object' or exists(select 1 from jsonb_object_keys(p_progress->'items') key where not exists(select 1 from public.library_items i where i.id=key::uuid and i.set_id=set_row.id and i.generation_version=(select max(x.generation_version) from public.library_items x where x.set_id=set_row.id and x.generation_version<=set_row.version))) then raise exception 'invalid library progress items' using errcode='22023'; end if;

  select * into existing from public.library_study_attempts where user_id=p_user_id and set_id=set_row.id and set_version=set_row.version for update;
  replace_attempt := not found or incoming_attempt<>existing.attempt_id and (incoming_reset>existing.reset_at or incoming_reset=existing.reset_at and incoming_attempt::text>existing.attempt_id::text);
  if found and incoming_attempt<>existing.attempt_id and not replace_attempt then return; end if;
  if found and incoming_attempt=existing.attempt_id then incoming_reset:=existing.reset_at; end if;
  if replace_attempt and existing.attempt_id is not null then delete from public.library_study_item_progress where user_id=p_user_id and set_id=set_row.id and set_version=set_row.version; end if;

  insert into public.library_study_attempts(user_id,set_id,set_version,output_type,attempt_id,reset_at,card_order,order_at,current_index,index_at,side,side_at,submitted,submitted_at,reviewing,reviewing_at,score,score_at,updated_at)
  values(p_user_id,set_row.id,set_row.version,set_row.output_type,incoming_attempt,incoming_reset,case when set_row.output_type='flashcards' then array(select jsonb_array_elements_text(p_progress->'order'->'value'))::uuid[] end,case when set_row.output_type='flashcards' then (p_progress->'order'->>'updatedAt')::timestamptz end,(p_progress->'index'->>'value')::integer,(p_progress->'index'->>'updatedAt')::timestamptz,p_progress->'side'->>'value',case when set_row.output_type='flashcards' then (p_progress->'side'->>'updatedAt')::timestamptz end,case when set_row.output_type='practice' then (p_progress->'submitted'->>'value')::boolean end,case when set_row.output_type='practice' then (p_progress->'submitted'->>'updatedAt')::timestamptz end,case when set_row.output_type='practice' then (p_progress->'reviewing'->>'value')::boolean end,case when set_row.output_type='practice' then (p_progress->'reviewing'->>'updatedAt')::timestamptz end,case when set_row.output_type='practice' and p_progress->'score'->'value'<>'null'::jsonb then (p_progress->'score'->>'value')::integer end,case when set_row.output_type='practice' then (p_progress->'score'->>'updatedAt')::timestamptz end,clock_timestamp())
  on conflict(user_id,set_id,set_version) do update set attempt_id=excluded.attempt_id,reset_at=excluded.reset_at,card_order=case when replace_attempt or (excluded.order_at,excluded.card_order::text)>(library_study_attempts.order_at,library_study_attempts.card_order::text) then excluded.card_order else library_study_attempts.card_order end,order_at=case when replace_attempt then excluded.order_at else greatest(library_study_attempts.order_at,excluded.order_at) end,current_index=case when replace_attempt or (excluded.index_at,excluded.current_index)>(library_study_attempts.index_at,library_study_attempts.current_index) then excluded.current_index else library_study_attempts.current_index end,index_at=case when replace_attempt then excluded.index_at else greatest(library_study_attempts.index_at,excluded.index_at) end,side=case when replace_attempt or (excluded.side_at,excluded.side)>(library_study_attempts.side_at,library_study_attempts.side) then excluded.side else library_study_attempts.side end,side_at=case when replace_attempt then excluded.side_at else greatest(library_study_attempts.side_at,excluded.side_at) end,submitted=case when replace_attempt or (excluded.submitted_at,excluded.submitted::int)>(library_study_attempts.submitted_at,library_study_attempts.submitted::int) then excluded.submitted else library_study_attempts.submitted end,submitted_at=case when replace_attempt then excluded.submitted_at else greatest(library_study_attempts.submitted_at,excluded.submitted_at) end,reviewing=case when replace_attempt or (excluded.reviewing_at,excluded.reviewing::int)>(library_study_attempts.reviewing_at,library_study_attempts.reviewing::int) then excluded.reviewing else library_study_attempts.reviewing end,reviewing_at=case when replace_attempt then excluded.reviewing_at else greatest(library_study_attempts.reviewing_at,excluded.reviewing_at) end,score=case when replace_attempt or (excluded.score_at,coalesce(excluded.score,-1))>(library_study_attempts.score_at,coalesce(library_study_attempts.score,-1)) then excluded.score else library_study_attempts.score end,score_at=case when replace_attempt then excluded.score_at else greatest(library_study_attempts.score_at,excluded.score_at) end,updated_at=clock_timestamp();

  for item in select key::uuid item_id,value state from jsonb_each(p_progress->'items') loop
    insert into public.library_study_item_progress(user_id,set_id,set_version,item_id,attempt_id,state,state_at) values(p_user_id,set_row.id,set_row.version,item.item_id,incoming_attempt,item.state,(item.state->>'updatedAt')::timestamptz)
    on conflict(user_id,set_id,set_version,item_id) do update set attempt_id=excluded.attempt_id,state=excluded.state,state_at=excluded.state_at where library_study_item_progress.attempt_id=excluded.attempt_id and (excluded.state_at,excluded.state::text)>(library_study_item_progress.state_at,library_study_item_progress.state::text);
  end loop;
end; $$;

revoke all on function public.merge_library_study_progress(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.merge_library_study_progress(uuid,jsonb) to service_role;
