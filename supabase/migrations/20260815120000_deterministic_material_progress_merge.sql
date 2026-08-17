create or replace function public.merge_material_learning_progress(
  p_release_id uuid,
  p_content_version text,
  p_read_section_ids text[],
  p_practice_answers jsonb,
  p_practice_submitted boolean,
  p_updated_at timestamptz
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('lock_timeout', '3s', true);

  insert into public.material_learning_progress (user_id, release_id, content_version, read_section_ids, practice_answers, practice_submitted, updated_at)
  values (
    auth.uid(),
    p_release_id,
    p_content_version,
    array(select distinct value from unnest(coalesce(p_read_section_ids, '{}')) value order by value),
    coalesce(p_practice_answers, '{}'),
    p_practice_submitted,
    p_updated_at
  )
  on conflict (user_id, release_id) do update set
    content_version = excluded.content_version,
    read_section_ids = case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.read_section_ids
      else array(select distinct value from unnest(public.material_learning_progress.read_section_ids || excluded.read_section_ids) value order by value)
    end,
    practice_answers = case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.practice_answers
      when excluded.updated_at > public.material_learning_progress.updated_at then public.material_learning_progress.practice_answers || excluded.practice_answers
      when excluded.updated_at < public.material_learning_progress.updated_at then excluded.practice_answers || public.material_learning_progress.practice_answers
      when public.material_learning_progress.practice_answers::text <= excluded.practice_answers::text then public.material_learning_progress.practice_answers || excluded.practice_answers
      else excluded.practice_answers || public.material_learning_progress.practice_answers
    end,
    practice_submitted = case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.practice_submitted
      else public.material_learning_progress.practice_submitted or excluded.practice_submitted
    end,
    updated_at = case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.updated_at
      else greatest(public.material_learning_progress.updated_at, excluded.updated_at)
    end
  where public.material_learning_progress.content_version is distinct from excluded.content_version
    or public.material_learning_progress.read_section_ids is distinct from case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.read_section_ids
      else array(select distinct value from unnest(public.material_learning_progress.read_section_ids || excluded.read_section_ids) value order by value)
    end
    or public.material_learning_progress.practice_answers is distinct from case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.practice_answers
      when excluded.updated_at > public.material_learning_progress.updated_at then public.material_learning_progress.practice_answers || excluded.practice_answers
      when excluded.updated_at < public.material_learning_progress.updated_at then excluded.practice_answers || public.material_learning_progress.practice_answers
      when public.material_learning_progress.practice_answers::text <= excluded.practice_answers::text then public.material_learning_progress.practice_answers || excluded.practice_answers
      else excluded.practice_answers || public.material_learning_progress.practice_answers
    end
    or public.material_learning_progress.practice_submitted is distinct from case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.practice_submitted
      else public.material_learning_progress.practice_submitted or excluded.practice_submitted
    end
    or public.material_learning_progress.updated_at is distinct from case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.updated_at
      else greatest(public.material_learning_progress.updated_at, excluded.updated_at)
    end;
end;
$$;

grant execute on function public.merge_material_learning_progress(uuid, text, text[], jsonb, boolean, timestamptz) to authenticated;
