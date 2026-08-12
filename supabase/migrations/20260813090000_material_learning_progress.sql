create table public.material_learning_progress (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  release_id uuid not null references public.material_releases (id) on delete cascade,
  content_version text not null,
  read_section_ids text[] not null default '{}',
  practice_answers jsonb not null default '{}',
  practice_submitted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, release_id),
  check (jsonb_typeof(practice_answers) = 'object')
);

alter table public.material_learning_progress enable row level security;
create policy material_learning_progress_select_own on public.material_learning_progress for select using (auth.uid() = user_id);
create policy material_learning_progress_insert_own on public.material_learning_progress for insert with check (auth.uid() = user_id);
create policy material_learning_progress_update_own on public.material_learning_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.material_learning_progress to authenticated;

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
  insert into public.material_learning_progress (user_id, release_id, content_version, read_section_ids, practice_answers, practice_submitted, updated_at)
  values (auth.uid(), p_release_id, p_content_version, coalesce(p_read_section_ids, '{}'), coalesce(p_practice_answers, '{}'), p_practice_submitted, p_updated_at)
  on conflict (user_id, release_id) do update set
    content_version = excluded.content_version,
    read_section_ids = case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.read_section_ids
      else array(select distinct value from unnest(public.material_learning_progress.read_section_ids || excluded.read_section_ids) value)
    end,
    practice_answers = case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.practice_answers
      when excluded.updated_at >= public.material_learning_progress.updated_at then public.material_learning_progress.practice_answers || excluded.practice_answers
      else excluded.practice_answers || public.material_learning_progress.practice_answers
    end,
    practice_submitted = case
      when public.material_learning_progress.content_version <> excluded.content_version then excluded.practice_submitted
      else public.material_learning_progress.practice_submitted or excluded.practice_submitted
    end,
    updated_at = greatest(public.material_learning_progress.updated_at, excluded.updated_at);
end;
$$;

grant execute on function public.merge_material_learning_progress(uuid, text, text[], jsonb, boolean, timestamptz) to authenticated;
