create table public.material_subjects (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  current_release_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.material_releases (
  id uuid primary key,
  subject_id uuid not null references public.material_subjects(id) on delete cascade,
  corpus_hash text not null check (corpus_hash ~ '^[a-f0-9]{64}$'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  notes_markdown text not null,
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  status text not null default 'staging' check (status in ('staging', 'published', 'superseded')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subject_id, content_hash),
  unique (id, subject_id)
);

alter table public.material_subjects add constraint material_subjects_current_release_fkey
  foreign key (current_release_id, id) references public.material_releases(id, subject_id) deferrable initially deferred;

create table public.material_sections (
  release_id uuid not null references public.material_releases(id) on delete cascade,
  stable_id text not null,
  ordinal integer not null check (ordinal >= 0),
  title text not null,
  heading_path jsonb not null check (jsonb_typeof(heading_path) = 'array'),
  content text not null,
  source_page_start integer not null check (source_page_start > 0),
  source_page_end integer not null check (source_page_end >= source_page_start),
  metadata jsonb not null default '{}'::jsonb,
  primary key (release_id, stable_id),
  unique (release_id, ordinal)
);

create table public.material_assets (
  release_id uuid not null references public.material_releases(id) on delete cascade,
  id uuid not null,
  original_path text not null check (original_path like './assets/%' and original_path !~ '(^|/)\.\.(/|$)'),
  file_name text not null,
  storage_path text not null,
  public_url text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg')),
  metadata jsonb not null default '{}'::jsonb,
  primary key (release_id, id),
  unique (release_id, original_path)
);

create table public.material_figures (
  release_id uuid not null references public.material_releases(id) on delete cascade,
  id uuid not null,
  asset_id uuid not null,
  placement integer not null check (placement >= 0),
  source_page integer not null check (source_page > 0),
  alt text not null default '',
  attribution text,
  metadata jsonb not null default '{}'::jsonb,
  primary key (release_id, id),
  unique (release_id, placement),
  foreign key (release_id, asset_id) references public.material_assets(release_id, id) on delete cascade
);

create table public.material_mnemonics (
  release_id uuid not null references public.material_releases(id) on delete cascade,
  stable_id text not null,
  ordinal integer not null check (ordinal >= 0),
  title text not null,
  body text not null,
  section text,
  source_page integer not null check (source_page > 0),
  metadata jsonb not null default '{}'::jsonb,
  primary key (release_id, stable_id),
  unique (release_id, ordinal)
);

create table public.material_flashcards (
  release_id uuid not null references public.material_releases(id) on delete cascade,
  stable_id text not null,
  ordinal integer not null check (ordinal >= 0),
  card_type text not null check (card_type in ('basic', 'cloze')),
  front text not null,
  back text not null,
  section text,
  source_page integer not null check (source_page > 0),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  metadata jsonb not null default '{}'::jsonb,
  primary key (release_id, stable_id),
  unique (release_id, ordinal)
);

create table public.material_questions (
  release_id uuid not null references public.material_releases(id) on delete cascade,
  stable_id text not null,
  ordinal integer not null check (ordinal >= 0),
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'object'),
  answer text not null check (answer in ('A', 'B', 'C', 'D')),
  explanation text not null,
  chapter text not null,
  section text not null,
  source_page integer not null check (source_page > 0),
  evidence_quote text not null,
  confidence text check (confidence in ('low', 'medium', 'high')),
  review_status text not null check (review_status in ('pending', 'approved', 'rejected')),
  published boolean not null default false,
  content_hash text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  primary key (release_id, stable_id),
  unique (release_id, ordinal),
  check (not published or review_status = 'approved')
);

create table public.material_import_runs (
  id uuid primary key,
  corpus_hash text not null unique check (corpus_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('running', 'completed', 'failed')),
  expected_subjects integer not null check (expected_subjects > 0),
  imported_subjects text[] not null default '{}',
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (status <> 'completed' or cardinality(imported_subjects) = expected_subjects)
);

create table public.material_import_subjects (
  run_id uuid not null references public.material_import_runs(id) on delete cascade,
  subject_slug text not null,
  subject_id uuid not null references public.material_subjects(id) on delete cascade,
  release_id uuid not null references public.material_releases(id) on delete cascade,
  staged_at timestamptz not null default now(),
  primary key (run_id, subject_slug),
  unique (run_id, subject_id),
  unique (run_id, release_id)
);

create index material_releases_corpus_idx on public.material_releases(corpus_hash, status);
create index material_releases_subject_published_idx on public.material_releases(subject_id, published_at desc) where status = 'published';
create index material_sections_release_page_idx on public.material_sections(release_id, source_page_start, ordinal);
create index material_figures_release_page_idx on public.material_figures(release_id, source_page, placement);
create index material_mnemonics_release_page_idx on public.material_mnemonics(release_id, source_page, ordinal);
create index material_flashcards_release_type_idx on public.material_flashcards(release_id, card_type, ordinal);
create index material_questions_release_status_idx on public.material_questions(release_id, review_status, ordinal) where published;
create index material_assets_release_sha_idx on public.material_assets(release_id, sha256);
create index material_assets_storage_path_idx on public.material_assets(storage_path);

create view public.material_subject_catalog with (security_invoker = true) as
select
  s.id,
  s.slug,
  s.title,
  r.id as release_id,
  r.corpus_hash,
  r.content_hash,
  r.published_at,
  (select count(*)::integer from public.material_sections x where x.release_id = r.id) as section_count,
  (select count(*)::integer from public.material_assets x where x.release_id = r.id) as asset_count,
  (select count(*)::integer from public.material_mnemonics x where x.release_id = r.id) as mnemonic_count,
  (select count(*)::integer from public.material_flashcards x where x.release_id = r.id) as flashcard_count,
  (select count(*)::integer from public.material_questions x where x.release_id = r.id and x.published and x.review_status = 'approved') as question_count
from public.material_subjects s
join public.material_releases r on r.id = s.current_release_id and r.status = 'published';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', true, 52428800, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy materials_storage_public_read on storage.objects for select to public using (bucket_id = 'materials');
create policy materials_storage_service_insert on storage.objects for insert to service_role with check (bucket_id = 'materials');
create policy materials_storage_service_update on storage.objects for update to service_role using (bucket_id = 'materials') with check (bucket_id = 'materials');
create policy materials_storage_service_delete on storage.objects for delete to service_role using (bucket_id = 'materials');

alter table public.material_subjects enable row level security;
alter table public.material_releases enable row level security;
alter table public.material_sections enable row level security;
alter table public.material_assets enable row level security;
alter table public.material_figures enable row level security;
alter table public.material_mnemonics enable row level security;
alter table public.material_flashcards enable row level security;
alter table public.material_questions enable row level security;
alter table public.material_import_runs enable row level security;
alter table public.material_import_subjects enable row level security;

create policy material_subjects_public_read on public.material_subjects for select to public using (current_release_id is not null);
create policy material_releases_public_read on public.material_releases for select to public using (status = 'published');
create policy material_sections_public_read on public.material_sections for select to public using (exists (select 1 from public.material_releases r where r.id = release_id and r.status = 'published'));
create policy material_assets_public_read on public.material_assets for select to public using (exists (select 1 from public.material_releases r where r.id = release_id and r.status = 'published'));
create policy material_figures_public_read on public.material_figures for select to public using (exists (select 1 from public.material_releases r where r.id = release_id and r.status = 'published'));
create policy material_mnemonics_public_read on public.material_mnemonics for select to public using (exists (select 1 from public.material_releases r where r.id = release_id and r.status = 'published'));
create policy material_flashcards_public_read on public.material_flashcards for select to public using (exists (select 1 from public.material_releases r where r.id = release_id and r.status = 'published'));
create policy material_questions_public_read on public.material_questions for select to public using (published and review_status = 'approved' and exists (select 1 from public.material_releases r where r.id = release_id and r.status = 'published'));
revoke all on public.material_subjects, public.material_releases, public.material_sections, public.material_assets, public.material_figures, public.material_mnemonics, public.material_flashcards, public.material_questions, public.material_import_runs, public.material_import_subjects from anon, authenticated;
grant select on public.material_subjects, public.material_releases, public.material_sections, public.material_assets, public.material_figures, public.material_mnemonics, public.material_flashcards, public.material_questions to anon, authenticated;
grant select on public.material_subject_catalog to anon, authenticated;
grant select, insert, update, delete on public.material_subjects, public.material_releases, public.material_sections, public.material_assets, public.material_figures, public.material_mnemonics, public.material_flashcards, public.material_questions, public.material_import_runs, public.material_import_subjects to service_role;

create or replace function public.import_materials_subject(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_subject jsonb := p_payload->'subject';
  v_release jsonb := p_payload->'release';
  v_subject_id uuid := (v_subject->>'id')::uuid;
  v_release_id uuid := (v_release->>'id')::uuid;
  v_run_id uuid := (p_payload->>'run_id')::uuid;
  v_slug text := v_subject->>'slug';
  v_corpus_hash text := v_release->>'corpusHash';
  v_expected integer := (p_payload->>'expected_subjects')::integer;
  v_imported text[];
  v_run_status text;
begin
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload->'sections') <> 'array' or jsonb_typeof(p_payload->'assets') <> 'array' or jsonb_typeof(p_payload->'figures') <> 'array' or jsonb_typeof(p_payload->'mnemonics') <> 'array' or jsonb_typeof(p_payload->'flashcards') <> 'array' or jsonb_typeof(p_payload->'questions') <> 'array' then
    raise exception 'malformed complete subject payload' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or v_corpus_hash !~ '^[a-f0-9]{64}$' or v_expected < 1 then
    raise exception 'invalid subject import identity' using errcode = '22023';
  end if;

  select status into v_run_status from public.material_import_runs where id = v_run_id;
  if v_run_status = 'completed' then
    return jsonb_build_object('subject', v_slug, 'corpusHash', v_corpus_hash, 'alreadyCompleted', true);
  end if;

  insert into public.material_import_runs(id, corpus_hash, status, expected_subjects)
  values (v_run_id, v_corpus_hash, 'running', v_expected)
  on conflict (id) do update set expected_subjects = excluded.expected_subjects
  where public.material_import_runs.corpus_hash = excluded.corpus_hash and public.material_import_runs.status in ('running', 'completed');
  if not found then raise exception 'import run identity conflict' using errcode = '23505'; end if;

  insert into public.material_subjects(id, slug, title) values (v_subject_id, v_slug, v_subject->>'title')
  on conflict (id) do update set slug = excluded.slug, title = excluded.title, updated_at = now();
  if exists (select 1 from public.material_subjects where slug = v_slug and id <> v_subject_id) then raise exception 'subject stable ID conflict'; end if;

  insert into public.material_releases(id, subject_id, corpus_hash, content_hash, notes_markdown, source_metadata, status)
  values (v_release_id, v_subject_id, v_corpus_hash, v_release->>'contentHash', v_release->>'notesMarkdown', coalesce(v_release->'sourceMetadata', '{}'::jsonb), 'staging')
  on conflict (id) do update set corpus_hash = excluded.corpus_hash, notes_markdown = excluded.notes_markdown, source_metadata = excluded.source_metadata, status = 'staging', published_at = null
  where public.material_releases.subject_id = excluded.subject_id and public.material_releases.content_hash = excluded.content_hash;
  if not found then raise exception 'release stable ID conflict' using errcode = '23505'; end if;

  delete from public.material_figures where release_id = v_release_id;
  delete from public.material_sections where release_id = v_release_id;
  delete from public.material_mnemonics where release_id = v_release_id;
  delete from public.material_flashcards where release_id = v_release_id;
  delete from public.material_questions where release_id = v_release_id;
  delete from public.material_assets where release_id = v_release_id;

  insert into public.material_sections(release_id, stable_id, ordinal, title, heading_path, content, source_page_start, source_page_end, metadata)
  select v_release_id, x.value->>'id', x.ordinality - 1, x.value->>'title', x.value->'heading_path', x.value->>'content', (x.value->>'source_page_start')::integer, (x.value->>'source_page_end')::integer, x.value - array['id','title','heading_path','content','source_page_start','source_page_end','subject']
  from jsonb_array_elements(p_payload->'sections') with ordinality x(value, ordinality);

  insert into public.material_assets(release_id, id, original_path, file_name, storage_path, public_url, sha256, byte_size, mime_type, metadata)
  select v_release_id, (x->>'id')::uuid, x->>'originalPath', x->>'fileName', x->>'storagePath', x->>'publicUrl', x->>'sha256', (x->>'byteSize')::bigint, x->>'mimeType', x - array['id','originalPath','fileName','storagePath','publicUrl','sha256','byteSize','mimeType']
  from jsonb_array_elements(p_payload->'assets') x;

  insert into public.material_figures(release_id, id, asset_id, placement, source_page, alt, attribution, metadata)
  select v_release_id, (x->>'id')::uuid, (x->>'asset_id')::uuid, (x->>'placement')::integer, (x->>'page')::integer, coalesce(x->>'alt',''), x->>'attribution', x - array['id','asset_id','placement','page','alt','attribution']
  from jsonb_array_elements(p_payload->'figures') x;

  insert into public.material_mnemonics(release_id, stable_id, ordinal, title, body, section, source_page, metadata)
  select v_release_id, x.value->>'id', x.ordinality - 1, x.value->>'title', x.value->>'body', x.value->>'section', (x.value->>'source_page')::integer, x.value - array['id','title','body','section','source_page','subject']
  from jsonb_array_elements(p_payload->'mnemonics') with ordinality x(value, ordinality);

  insert into public.material_flashcards(release_id, stable_id, ordinal, card_type, front, back, section, source_page, tags, metadata)
  select v_release_id, x.value->>'id', x.ordinality - 1, x.value->>'type', x.value->>'front', x.value->>'back', x.value->>'section', (x.value->>'source_page')::integer, coalesce(x.value->'tags','[]'::jsonb), x.value - array['id','type','front','back','section','source_page','tags','subject']
  from jsonb_array_elements(p_payload->'flashcards') with ordinality x(value, ordinality);

  insert into public.material_questions(release_id, stable_id, ordinal, question, options, answer, explanation, chapter, section, source_page, evidence_quote, confidence, review_status, published, content_hash, metadata)
  select v_release_id, x.value->>'id', x.ordinality - 1, x.value->>'question', x.value->'options', x.value->>'answer', x.value->>'explanation', x.value->>'chapter', x.value->>'section', (x.value->>'source_page')::integer, x.value->>'evidence_quote', x.value->>'confidence', x.value->>'status', (x.value->>'published')::boolean, x.value->>'content_hash', x.value - array['id','question','options','answer','explanation','chapter','section','source_page','evidence_quote','confidence','status','published','content_hash','subject']
  from jsonb_array_elements(p_payload->'questions') with ordinality x(value, ordinality);

  insert into public.material_import_subjects(run_id, subject_slug, subject_id, release_id)
  values (v_run_id, v_slug, v_subject_id, v_release_id)
  on conflict (run_id, subject_slug) do update set subject_id = excluded.subject_id, release_id = excluded.release_id, staged_at = now();
  update public.material_import_runs set imported_subjects = (select array_agg(subject_slug order by subject_slug) from public.material_import_subjects where run_id = v_run_id) where id = v_run_id returning imported_subjects into v_imported;
  return jsonb_build_object('subject', v_slug, 'releaseId', v_release_id, 'corpusHash', v_corpus_hash, 'stagedSubjects', cardinality(v_imported));
end; $$;

create or replace function public.finalize_materials_import(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run public.material_import_runs%rowtype;
  v_staged integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('materials-import', 0));
  select * into v_run from public.material_import_runs where id = p_run_id for update;
  if not found then raise exception 'materials import run not found' using errcode = '22023'; end if;
  if v_run.status = 'completed' then
    return jsonb_build_object('corpusHash', v_run.corpus_hash, 'publishedSubjects', v_run.expected_subjects, 'alreadyCompleted', true);
  end if;
  select count(*) into v_staged
  from public.material_import_subjects x
  join public.material_releases r on r.id = x.release_id and r.subject_id = x.subject_id
  where x.run_id = p_run_id and r.status = 'staging';
  if v_staged <> v_run.expected_subjects then
    raise exception 'materials import is incomplete: expected %, staged %', v_run.expected_subjects, v_staged using errcode = '22023';
  end if;
  update public.material_releases r set status = 'superseded'
  where r.status = 'published'
    and exists (select 1 from public.material_import_subjects x where x.run_id = p_run_id and x.subject_id = r.subject_id and x.release_id <> r.id);
  update public.material_releases r set status = 'published', published_at = coalesce(r.published_at, now())
  where exists (select 1 from public.material_import_subjects x where x.run_id = p_run_id and x.release_id = r.id);
  update public.material_subjects s set current_release_id = x.release_id, updated_at = now()
  from public.material_import_subjects x where x.run_id = p_run_id and x.subject_id = s.id;
  update public.material_import_runs set status = 'completed', completed_at = now(), imported_subjects = (select array_agg(subject_slug order by subject_slug) from public.material_import_subjects where run_id = p_run_id) where id = p_run_id;
  return jsonb_build_object('corpusHash', v_run.corpus_hash, 'publishedSubjects', v_staged);
end; $$;

revoke all on function public.import_materials_subject(jsonb) from public, anon, authenticated;
grant execute on function public.import_materials_subject(jsonb) to service_role;
revoke all on function public.finalize_materials_import(uuid) from public, anon, authenticated;
grant execute on function public.finalize_materials_import(uuid) to service_role;
