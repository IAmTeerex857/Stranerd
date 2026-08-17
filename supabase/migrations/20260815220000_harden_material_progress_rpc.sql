revoke insert, update, delete on public.material_learning_progress from authenticated;
revoke all on function public.merge_material_learning_progress(uuid, text, text[], jsonb, boolean, timestamptz) from public, anon, authenticated;

create or replace function public.merge_material_learning_progress(
  p_release_id uuid,
  p_content_version text,
  p_read_section_ids text[],
  p_practice_answers jsonb,
  p_practice_submitted boolean,
  p_updated_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  perform set_config('lock_timeout', '3s', true);
  if actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_updated_at is null or p_updated_at < timestamptz '2020-01-01' or p_updated_at > clock_timestamp() + interval '5 minutes'
    or p_content_version is null or char_length(p_content_version) > 128
    or coalesce(cardinality(p_read_section_ids), 0) > 500
    or p_practice_submitted is null
    or jsonb_typeof(coalesce(p_practice_answers, '{}')) <> 'object'
    or (select count(*) from jsonb_object_keys(coalesce(p_practice_answers, '{}'))) > 200 then
    raise exception 'invalid material progress' using errcode = '22023';
  end if;
  if not exists (select 1 from public.material_releases r where r.id = p_release_id and r.status = 'published' and r.content_hash = p_content_version) then
    raise exception 'published material version not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from unnest(coalesce(p_read_section_ids, '{}')) id where char_length(id) not between 1 and 300 or not exists (select 1 from public.material_sections s where s.release_id = p_release_id and s.stable_id = id))
    or exists (select 1 from jsonb_each(coalesce(p_practice_answers, '{}')) a where char_length(a.key) not between 1 and 300 or jsonb_typeof(a.value) <> 'number' or (a.value #>> '{}')::numeric not in (0,1,2,3) or not exists (select 1 from public.material_questions q where q.release_id = p_release_id and q.stable_id = a.key and q.published and q.review_status = 'approved')) then
    raise exception 'material progress contains invalid items' using errcode = '22023';
  end if;

  insert into public.material_learning_progress(user_id,release_id,content_version,read_section_ids,practice_answers,practice_submitted,updated_at)
  values(actor,p_release_id,p_content_version,array(select distinct id from unnest(coalesce(p_read_section_ids,'{}')) id order by id),coalesce(p_practice_answers,'{}'),p_practice_submitted,p_updated_at)
  on conflict(user_id,release_id) do update set
    content_version=excluded.content_version,
    read_section_ids=case when public.material_learning_progress.content_version<>excluded.content_version then excluded.read_section_ids else array(select distinct id from unnest(public.material_learning_progress.read_section_ids || excluded.read_section_ids) id order by id) end,
    practice_answers=case when public.material_learning_progress.content_version<>excluded.content_version then excluded.practice_answers when excluded.updated_at > public.material_learning_progress.updated_at then public.material_learning_progress.practice_answers || excluded.practice_answers when excluded.updated_at < public.material_learning_progress.updated_at then excluded.practice_answers || public.material_learning_progress.practice_answers when public.material_learning_progress.practice_answers::text <= excluded.practice_answers::text then public.material_learning_progress.practice_answers || excluded.practice_answers else excluded.practice_answers || public.material_learning_progress.practice_answers end,
    practice_submitted=case when public.material_learning_progress.content_version<>excluded.content_version then excluded.practice_submitted else public.material_learning_progress.practice_submitted or excluded.practice_submitted end,
    updated_at=case when public.material_learning_progress.content_version<>excluded.content_version then excluded.updated_at else greatest(public.material_learning_progress.updated_at,excluded.updated_at) end
  where public.material_learning_progress.content_version<>excluded.content_version
    or public.material_learning_progress.read_section_ids is distinct from array(select distinct id from unnest(public.material_learning_progress.read_section_ids || excluded.read_section_ids) id order by id)
    or public.material_learning_progress.practice_answers is distinct from case when excluded.updated_at > public.material_learning_progress.updated_at then public.material_learning_progress.practice_answers || excluded.practice_answers when excluded.updated_at < public.material_learning_progress.updated_at then excluded.practice_answers || public.material_learning_progress.practice_answers when public.material_learning_progress.practice_answers::text <= excluded.practice_answers::text then public.material_learning_progress.practice_answers || excluded.practice_answers else excluded.practice_answers || public.material_learning_progress.practice_answers end
    or public.material_learning_progress.practice_submitted is distinct from (public.material_learning_progress.practice_submitted or excluded.practice_submitted)
    or public.material_learning_progress.updated_at<excluded.updated_at;
end; $$;

grant select on public.material_learning_progress to authenticated;
grant execute on function public.merge_material_learning_progress(uuid, text, text[], jsonb, boolean, timestamptz) to authenticated;
