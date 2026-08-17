create extension if not exists pgcrypto with schema extensions;

alter table public.credit_reservations drop constraint credit_reservations_feature_check;
alter table public.credit_reservations add constraint credit_reservations_feature_check
  check (feature in ('mentor', 'ai_quiz', 'ai_flashcards', 'voice_session', 'library_generation'));

alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('mentor', 'ai_quiz', 'ai_flashcards', 'library_generation'));

alter table public.credit_transactions drop constraint credit_transactions_feature_check;
alter table public.credit_transactions add constraint credit_transactions_feature_check
  check (feature in ('signup', 'mentor', 'ai_quiz', 'ai_flashcards', 'flashcard_unlock', 'voice_session', 'library_generation', 'subscription', 'payg', 'admin'));

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_feature text,
  p_amount integer,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.credit_wallets%rowtype;
  reservation public.credit_reservations%rowtype;
  free_reserved integer;
  subscription_reserved integer;
  purchased_reserved integer;
begin
  if p_feature not in ('mentor', 'ai_quiz', 'library_generation') then
    raise exception 'unsupported credit feature' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'credit amount must be positive' using errcode = '22023';
  end if;
  if p_request_id is null or length(p_request_id) = 0 then
    raise exception 'request ID is required' using errcode = '22023';
  end if;

  perform 1 from auth.users where id = p_user_id for key share;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select * into reservation
  from public.credit_reservations
  where request_id = p_request_id;

  if found then
    if reservation.user_id <> p_user_id
      or reservation.feature <> p_feature
      or reservation.amount <> p_amount then
      raise exception 'request ID is already in use' using errcode = '23505';
    end if;

    select * into wallet from public.credit_wallets where user_id = p_user_id;
    return jsonb_build_object(
      'reservationId', reservation.id,
      'requestId', reservation.request_id,
      'status', reservation.status,
      'freeBalance', wallet.free_balance,
      'subscriptionBalance', wallet.subscription_balance,
      'purchasedBalance', wallet.purchased_balance
    );
  end if;

  select * into wallet
  from public.credit_wallets
  where user_id = p_user_id
  for update;
  if not found then
    raise exception 'credit wallet not found' using errcode = 'P0002';
  end if;

  select * into reservation
  from public.credit_reservations
  where request_id = p_request_id;
  if found then
    if reservation.user_id <> p_user_id
      or reservation.feature <> p_feature
      or reservation.amount <> p_amount then
      raise exception 'request ID is already in use' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'reservationId', reservation.id,
      'requestId', reservation.request_id,
      'status', reservation.status,
      'freeBalance', wallet.free_balance,
      'subscriptionBalance', wallet.subscription_balance,
      'purchasedBalance', wallet.purchased_balance
    );
  end if;

  if wallet.free_balance::bigint + wallet.subscription_balance + wallet.purchased_balance < p_amount then
    raise exception 'insufficient credits' using errcode = 'P0001';
  end if;

  free_reserved := least(wallet.free_balance, p_amount);
  subscription_reserved := least(wallet.subscription_balance, p_amount - free_reserved);
  purchased_reserved := p_amount - free_reserved - subscription_reserved;

  update public.credit_wallets
  set free_balance = free_balance - free_reserved,
      subscription_balance = subscription_balance - subscription_reserved,
      purchased_balance = purchased_balance - purchased_reserved
  where user_id = p_user_id
  returning * into wallet;

  insert into public.credit_reservations (
    user_id, feature, amount, request_id, bucket_breakdown, subscription_period_key, expires_at
  ) values (
    p_user_id,
    p_feature,
    p_amount,
    p_request_id,
    jsonb_build_object('free', free_reserved, 'subscription', subscription_reserved, 'purchased', purchased_reserved),
    wallet.subscription_period_key,
    clock_timestamp() + case when p_feature = 'library_generation' then interval '2 hours' else interval '10 minutes' end
  ) returning * into reservation;

  insert into public.credit_transactions (
    user_id, amount, bucket, type, feature, reference, idempotency_key, metadata
  )
  select
    p_user_id, -entry.amount, entry.bucket, 'reserve', p_feature, reservation.id::text,
    'reserve:' || p_request_id || ':' || entry.bucket,
    jsonb_build_object('reservationId', reservation.id, 'requestId', p_request_id)
  from (values
    ('free', free_reserved),
    ('subscription', subscription_reserved),
    ('purchased', purchased_reserved)
  ) as entry(bucket, amount)
  where entry.amount > 0;

  return jsonb_build_object(
    'reservationId', reservation.id,
    'requestId', reservation.request_id,
    'status', reservation.status,
    'freeBalance', wallet.free_balance,
    'subscriptionBalance', wallet.subscription_balance,
    'purchasedBalance', wallet.purchased_balance
  );
end;
$$;

create table public.library_sets (
  id uuid primary key,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  output_type text not null check (output_type in ('flashcards', 'practice')),
  source_category text not null check (source_category in ('prompt', 'document', 'audio', 'link', 'youtube')),
  requested_count integer not null,
  item_count integer not null default 0 check (item_count >= 0),
  generation_cost integer not null,
  version integer not null default 0 check (version >= 0),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, creator_user_id),
  check (
    (output_type = 'flashcards' and requested_count in (10, 15, 20, 30))
    or (output_type = 'practice' and requested_count in (10, 20, 30, 40))
  ),
  check (generation_cost = ((requested_count + 9) / 10) * 5)
);

create table public.library_jobs (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null,
  creator_user_id uuid not null,
  request_id uuid not null unique,
  reservation_id uuid not null unique,
  target_version integer not null check (target_version > 0),
  title text not null check (char_length(title) between 1 and 160),
  output_type text not null check (output_type in ('flashcards', 'practice')),
  source_category text not null check (source_category in ('prompt', 'document', 'audio', 'link', 'youtube')),
  requested_count integer not null,
  generation_cost integer not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (set_id, creator_user_id) references public.library_sets(id, creator_user_id) on delete cascade,
  foreign key (reservation_id, creator_user_id) references public.credit_reservations(id, user_id) on delete cascade,
  unique (set_id, target_version),
  unique (id, set_id, target_version, source_category),
  unique (id, set_id, target_version, output_type),
  check (
    (output_type = 'flashcards' and requested_count in (10, 15, 20, 30))
    or (output_type = 'practice' and requested_count in (10, 20, 30, 40))
  ),
  check (generation_cost = ((requested_count + 9) / 10) * 5),
  check ((status in ('queued', 'processing') and completed_at is null) or (status in ('completed', 'failed') and completed_at is not null)),
  check (started_at is null or started_at >= created_at),
  check (completed_at is null or completed_at >= created_at)
);

create table public.library_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  set_id uuid not null,
  generation_version integer not null,
  ordinal integer not null check (ordinal >= 0),
  category text not null check (category in ('prompt', 'document', 'audio', 'link', 'youtube')),
  input_text text,
  source_url text,
  storage_path text,
  file_name text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size between 1 and 26214400),
  created_at timestamptz not null default now(),
  foreign key (job_id, set_id, generation_version, category)
    references public.library_jobs(id, set_id, target_version, source_category) on delete cascade,
  unique (job_id, ordinal),
  check (
    (category = 'prompt' and input_text is not null and char_length(input_text) between 1 and 20000
      and source_url is null and storage_path is null and file_name is null and mime_type is null and byte_size is null)
    or (category = 'document' and input_text is null and source_url is null and storage_path is not null and file_name is not null
      and char_length(file_name) between 1 and 255 and mime_type is not null
      and mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/x-markdown') and byte_size is not null)
    or (category = 'audio' and input_text is null and source_url is null and storage_path is not null and file_name is not null
      and char_length(file_name) between 1 and 255 and mime_type is not null
      and mime_type in ('audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave') and byte_size is not null)
    or (category in ('link', 'youtube') and input_text is null and source_url is not null and source_url ~* '^https://[^[:space:]]+$'
      and storage_path is null and file_name is null and mime_type is null and byte_size is null)
  )
);

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  set_id uuid not null,
  generation_version integer not null check (generation_version > 0),
  output_type text not null check (output_type in ('flashcards', 'practice')),
  ordinal integer not null check (ordinal >= 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_id, set_id, generation_version, output_type)
    references public.library_jobs(id, set_id, target_version, output_type) on delete cascade,
  unique (set_id, generation_version, ordinal),
  check (
    (output_type = 'flashcards'
      and content ? 'front' and content ? 'back'
      and jsonb_typeof(content->'front') = 'string' and char_length(content->>'front') > 0
      and jsonb_typeof(content->'back') = 'string' and char_length(content->>'back') > 0)
    or (output_type = 'practice'
      and content ? 'question' and content ? 'options' and content ? 'correctIndex' and content ? 'explanation'
      and jsonb_typeof(content->'question') = 'string' and char_length(content->>'question') > 0
      and jsonb_typeof(content->'options') = 'array' and jsonb_array_length(content->'options') = 4
      and jsonb_typeof(content->'correctIndex') = 'number' and (content->>'correctIndex')::integer between 0 and 3
      and jsonb_typeof(content->'explanation') = 'string')
  )
);

create table public.library_share_links (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null,
  creator_user_id uuid not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (set_id, creator_user_id) references public.library_sets(id, creator_user_id) on delete cascade,
  check (expires_at is null or expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create index library_sets_creator_updated_idx on public.library_sets(creator_user_id, updated_at desc);
create index library_jobs_creator_created_idx on public.library_jobs(creator_user_id, created_at desc);
create index library_jobs_status_created_idx on public.library_jobs(status, created_at) where status in ('queued', 'processing');
create index library_sources_set_version_idx on public.library_sources(set_id, generation_version, ordinal);
create index library_items_set_version_idx on public.library_items(set_id, generation_version, ordinal);
create index library_share_links_set_active_idx on public.library_share_links(set_id, expires_at) where revoked_at is null;

create trigger library_sets_set_updated_at before update on public.library_sets
for each row execute function public.set_updated_at();
create trigger library_jobs_set_updated_at before update on public.library_jobs
for each row execute function public.set_updated_at();
create trigger library_items_set_updated_at before update on public.library_items
for each row execute function public.set_updated_at();
create trigger library_share_links_set_updated_at before update on public.library_share_links
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-inputs',
  'library-inputs',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/x-markdown',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/vnd.wave'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy library_inputs_select_own on storage.objects for select to authenticated
using (bucket_id = 'library-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy library_inputs_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'library-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy library_inputs_update_own on storage.objects for update to authenticated
using (bucket_id = 'library-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'library-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy library_inputs_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'library-inputs' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.library_sets enable row level security;
alter table public.library_sources enable row level security;
alter table public.library_items enable row level security;
alter table public.library_jobs enable row level security;
alter table public.library_share_links enable row level security;

create policy library_sets_creator_select on public.library_sets for select to authenticated
using (creator_user_id = (select auth.uid()));
create policy library_sources_creator_select on public.library_sources for select to authenticated
using (exists (
  select 1 from public.library_sets s where s.id = set_id and s.creator_user_id = (select auth.uid())
));
create policy library_items_creator_select on public.library_items for select to authenticated
using (exists (
  select 1 from public.library_sets s where s.id = set_id and s.creator_user_id = (select auth.uid())
));
create policy library_jobs_creator_select on public.library_jobs for select to authenticated
using (creator_user_id = (select auth.uid()));
create policy library_share_links_creator_select on public.library_share_links for select to authenticated
using (creator_user_id = (select auth.uid()));

revoke all on public.library_sets, public.library_sources, public.library_items, public.library_jobs, public.library_share_links from anon, authenticated;
grant select on public.library_sets, public.library_sources, public.library_items, public.library_jobs, public.library_share_links to authenticated;
grant select, insert, update, delete on public.library_sets, public.library_sources, public.library_items, public.library_jobs, public.library_share_links to service_role;

create or replace function public.create_library_generation(
  p_user_id uuid,
  p_set_id uuid,
  p_request_id uuid,
  p_expected_version integer,
  p_title text,
  p_output_type text,
  p_requested_count integer,
  p_source_category text,
  p_sources jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  set_row public.library_sets%rowtype;
  job_row public.library_jobs%rowtype;
  reservation_result jsonb;
  reservation_id uuid;
  v_generation_cost integer;
  target_version integer;
begin
  select * into job_row from public.library_jobs where request_id = p_request_id;
  if found then
    if job_row.creator_user_id <> p_user_id or job_row.set_id <> p_set_id or job_row.title <> btrim(p_title)
      or job_row.output_type <> p_output_type or job_row.requested_count <> p_requested_count
      or job_row.source_category <> p_source_category then
      raise exception 'request ID is already in use' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'setId', job_row.set_id, 'jobId', job_row.id, 'reservationId', job_row.reservation_id,
      'version', job_row.target_version, 'cost', job_row.generation_cost, 'status', job_row.status
    );
  end if;

  if p_user_id is null or p_set_id is null or p_request_id is null
    or char_length(btrim(coalesce(p_title, ''))) not between 1 and 160
    or p_source_category not in ('prompt', 'document', 'audio', 'link', 'youtube')
    or p_output_type not in ('flashcards', 'practice')
    or not (
      (p_output_type = 'flashcards' and p_requested_count in (10, 15, 20, 30))
      or (p_output_type = 'practice' and p_requested_count in (10, 20, 30, 40))
    )
    or jsonb_typeof(p_sources) <> 'array'
    or jsonb_array_length(p_sources) not between 1 and 10 then
    raise exception 'invalid library generation request' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_sources) source(value)
    where jsonb_typeof(source.value) <> 'object'
      or (source.value ? 'category' and source.value->>'category' <> p_source_category)
  ) then
    raise exception 'library sources must be homogeneous' using errcode = '22023';
  end if;

  if p_source_category = 'prompt' and exists (
    select 1 from jsonb_array_elements(p_sources) source(value)
    where source.value->>'text' is null or char_length(source.value->>'text') not between 1 and 20000
  ) then raise exception 'invalid prompt source' using errcode = '22023';
  elsif p_source_category in ('link', 'youtube') and exists (
    select 1 from jsonb_array_elements(p_sources) source(value)
    where source.value->>'url' is null or source.value->>'url' !~* '^https://[^[:space:]]+$'
  ) then raise exception 'invalid URL source' using errcode = '22023';
  elsif p_source_category = 'document' and exists (
    select 1 from jsonb_array_elements(p_sources) source(value)
    where source.value->>'storagePath' is null or source.value->>'storagePath' not like p_user_id::text || '/%'
      or char_length(coalesce(source.value->>'fileName', '')) not between 1 and 255
      or source.value->>'mimeType' is null
      or source.value->>'mimeType' not in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/x-markdown')
      or source.value->>'byteSize' is null or (source.value->>'byteSize')::bigint not between 1 and 26214400
  ) then raise exception 'invalid document source' using errcode = '22023';
  elsif p_source_category = 'audio' and exists (
    select 1 from jsonb_array_elements(p_sources) source(value)
    where source.value->>'storagePath' is null or source.value->>'storagePath' not like p_user_id::text || '/%'
      or char_length(coalesce(source.value->>'fileName', '')) not between 1 and 255
      or source.value->>'mimeType' is null
      or source.value->>'mimeType' not in ('audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave')
      or source.value->>'byteSize' is null or (source.value->>'byteSize')::bigint not between 1 and 26214400
  ) then raise exception 'invalid audio source' using errcode = '22023';
  end if;

  select * into set_row from public.library_sets where id = p_set_id for update;
  if found then
    if set_row.creator_user_id <> p_user_id then raise exception 'library set not found' using errcode = 'P0002'; end if;
    if p_expected_version is null or p_expected_version <> set_row.version then
      raise exception 'library set version conflict' using errcode = '40001';
    end if;
    if set_row.status = 'generating' then raise exception 'library set already has an active generation' using errcode = 'P0001'; end if;
    target_version := set_row.version + 1;
  else
    if p_expected_version is not null then raise exception 'library set not found' using errcode = 'P0002'; end if;
    target_version := 1;
  end if;

  v_generation_cost := ((p_requested_count + 9) / 10) * 5;
  reservation_result := public.reserve_credits(p_user_id, 'library_generation', v_generation_cost, p_request_id::text);
  reservation_id := (reservation_result->>'reservationId')::uuid;
  if reservation_result->>'status' <> 'reserved' then
    raise exception 'library generation reservation is not active' using errcode = 'P0001';
  end if;

  if set_row.id is null then
    insert into public.library_sets (
      id, creator_user_id, title, output_type, source_category, requested_count, generation_cost, version, status
    ) values (
      p_set_id, p_user_id, btrim(p_title), p_output_type, p_source_category, p_requested_count, v_generation_cost, 0, 'generating'
    );
  else
    update public.library_sets
    set status = 'generating'
    where id = p_set_id;
  end if;

  insert into public.library_jobs (
    set_id, creator_user_id, request_id, reservation_id, target_version, title,
    output_type, source_category, requested_count, generation_cost
  ) values (
    p_set_id, p_user_id, p_request_id, reservation_id, target_version, btrim(p_title),
    p_output_type, p_source_category, p_requested_count, v_generation_cost
  ) returning * into job_row;

  insert into public.library_sources (
    job_id, set_id, generation_version, ordinal, category,
    input_text, source_url, storage_path, file_name, mime_type, byte_size
  )
  select
    job_row.id, p_set_id, target_version, source.ordinality - 1, p_source_category,
    case when p_source_category = 'prompt' then source.value->>'text' end,
    case when p_source_category in ('link', 'youtube') then source.value->>'url' end,
    case when p_source_category in ('document', 'audio') then source.value->>'storagePath' end,
    case when p_source_category in ('document', 'audio') then source.value->>'fileName' end,
    case when p_source_category in ('document', 'audio') then source.value->>'mimeType' end,
    case when p_source_category in ('document', 'audio') then (source.value->>'byteSize')::bigint end
  from jsonb_array_elements(p_sources) with ordinality source(value, ordinality);

  return jsonb_build_object(
    'setId', p_set_id, 'jobId', job_row.id, 'reservationId', reservation_id,
    'version', target_version, 'cost', v_generation_cost, 'status', job_row.status,
    'freeBalance', reservation_result->'freeBalance',
    'subscriptionBalance', reservation_result->'subscriptionBalance',
    'purchasedBalance', reservation_result->'purchasedBalance'
  );
end;
$$;

create or replace function public.claim_library_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare job_row public.library_jobs%rowtype;
begin
  select * into job_row from public.library_jobs where id = p_job_id for update;
  if not found then raise exception 'library job not found' using errcode = 'P0002'; end if;
  if job_row.status = 'queued' or (job_row.status = 'processing' and job_row.started_at < clock_timestamp() - interval '9 minutes') then
    update public.library_jobs
    set status = 'processing', attempt_count = attempt_count + 1, started_at = clock_timestamp(), error = null
    where id = p_job_id returning * into job_row;
  else
    raise exception 'library job cannot be claimed from status %', job_row.status using errcode = 'P0001';
  end if;
  return jsonb_build_object('jobId', job_row.id, 'setId', job_row.set_id, 'version', job_row.target_version, 'status', job_row.status);
end;
$$;

create or replace function public.finalize_library_generation(p_job_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.library_jobs%rowtype;
  credit_result jsonb;
begin
  select * into job_row from public.library_jobs where id = p_job_id for update;
  if not found then raise exception 'library job not found' using errcode = 'P0002'; end if;
  if job_row.status = 'completed' then
    return jsonb_build_object('jobId', job_row.id, 'setId', job_row.set_id, 'version', job_row.target_version, 'status', job_row.status);
  end if;
  if job_row.status not in ('queued', 'processing') then
    raise exception 'library job cannot be finalized from status %', job_row.status using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> job_row.requested_count
    or exists (select 1 from jsonb_array_elements(p_items) item(value) where jsonb_typeof(item.value) <> 'object') then
    raise exception 'generated library item count or shape is invalid' using errcode = '22023';
  end if;

  delete from public.library_items where job_id = p_job_id;
  insert into public.library_items (job_id, set_id, generation_version, output_type, ordinal, content)
  select job_row.id, job_row.set_id, job_row.target_version, job_row.output_type, item.ordinality - 1, item.value
  from jsonb_array_elements(p_items) with ordinality item(value, ordinality);

  credit_result := public.finalize_credit_reservation(job_row.creator_user_id, job_row.request_id::text);
  update public.library_jobs
  set status = 'completed', started_at = coalesce(started_at, clock_timestamp()), completed_at = clock_timestamp(), error = null
  where id = p_job_id returning * into job_row;
  update public.library_sets
  set version = job_row.target_version, title = job_row.title, output_type = job_row.output_type, source_category = job_row.source_category,
      requested_count = job_row.requested_count, item_count = job_row.requested_count,
      generation_cost = job_row.generation_cost, status = 'ready'
  where id = job_row.set_id;

  return jsonb_build_object(
    'jobId', job_row.id, 'setId', job_row.set_id, 'version', job_row.target_version,
    'status', job_row.status, 'creditStatus', credit_result->'status'
  );
end;
$$;

create or replace function public.fail_library_generation(p_job_id uuid, p_error text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.library_jobs%rowtype;
  reservation_status text;
begin
  select * into job_row from public.library_jobs where id = p_job_id for update;
  if not found then raise exception 'library job not found' using errcode = 'P0002'; end if;
  if job_row.status = 'completed' then raise exception 'completed library job cannot fail' using errcode = 'P0001'; end if;
  if job_row.status = 'failed' then
    return jsonb_build_object('jobId', job_row.id, 'setId', job_row.set_id, 'status', job_row.status);
  end if;

  select status into reservation_status from public.credit_reservations where id = job_row.reservation_id for update;
  if reservation_status = 'reserved' then
    perform public.refund_credit_reservation(job_row.creator_user_id, job_row.request_id::text);
  end if;
  update public.library_jobs
  set status = 'failed', completed_at = clock_timestamp(), error = left(coalesce(nullif(p_error, ''), 'generation_failed'), 1000)
  where id = p_job_id returning * into job_row;
  update public.library_sets
  set status = case when version > 0 then 'ready' else 'failed' end
  where id = job_row.set_id and status = 'generating';
  return jsonb_build_object('jobId', job_row.id, 'setId', job_row.set_id, 'status', job_row.status);
end;
$$;

create or replace function public.reconcile_library_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.feature = 'library_generation' and new.status in ('refunded', 'expired') and old.status is distinct from new.status then
    update public.library_jobs
    set status = 'failed', completed_at = coalesce(completed_at, clock_timestamp()),
        error = coalesce(error, 'credit_reservation_' || new.status)
    where reservation_id = new.id and status in ('queued', 'processing');
    update public.library_sets s
    set status = case when s.version > 0 then 'ready' else 'failed' end
    where s.status = 'generating'
      and exists (select 1 from public.library_jobs j where j.reservation_id = new.id and j.set_id = s.id);
  end if;
  return new;
end;
$$;

create trigger credit_reservation_reconciles_library
after update of status on public.credit_reservations
for each row execute function public.reconcile_library_reservation();

create or replace function public.create_library_share_link(
  p_user_id uuid,
  p_set_id uuid,
  p_token text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare link_id uuid;
begin
  if char_length(coalesce(p_token, '')) < 32 or (p_expires_at is not null and p_expires_at <= clock_timestamp()) then
    raise exception 'invalid library share link' using errcode = '22023';
  end if;
  if not exists (select 1 from public.library_sets where id = p_set_id and creator_user_id = p_user_id and status = 'ready') then
    raise exception 'ready library set not found' using errcode = 'P0002';
  end if;
  insert into public.library_share_links(set_id, creator_user_id, token_hash, expires_at)
  values (p_set_id, p_user_id, extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), p_expires_at)
  returning id into link_id;
  return link_id;
end;
$$;

create or replace function public.revoke_library_share_link(p_user_id uuid, p_link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.library_share_links set revoked_at = coalesce(revoked_at, clock_timestamp())
  where id = p_link_id and creator_user_id = p_user_id;
  return found;
end;
$$;

create or replace function public.get_library_share_metadata(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if char_length(coalesce(p_token, '')) < 32 then return null; end if;
  select jsonb_build_object(
    'setId', s.id,
    'title', s.title,
    'outputType', s.output_type,
    'itemCount', (select count(*) from public.library_items i where i.set_id = s.id and i.generation_version = (select max(current_item.generation_version) from public.library_items current_item where current_item.set_id = s.id and current_item.generation_version <= s.version)),
    'version', s.version,
    'updatedAt', s.updated_at
  ) into result
  from public.library_share_links link
  join public.library_sets s on s.id = link.set_id
  where link.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > clock_timestamp())
    and s.status = 'ready';
  return result;
end;
$$;

create or replace function public.get_library_shared_set(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if char_length(coalesce(p_token, '')) < 32 then return null; end if;
  select jsonb_build_object(
    'setId', s.id,
    'title', s.title,
    'outputType', s.output_type,
    'itemCount', (select count(*) from public.library_items count_item where count_item.set_id = s.id and count_item.generation_version = (select max(current_item.generation_version) from public.library_items current_item where current_item.set_id = s.id and current_item.generation_version <= s.version)),
    'version', s.version,
    'updatedAt', s.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'ordinal', i.ordinal, 'content', i.content) order by i.ordinal)
       from public.library_items i
       where i.set_id = s.id
         and i.generation_version = (select max(current_item.generation_version) from public.library_items current_item where current_item.set_id = s.id and current_item.generation_version <= s.version)
    ), '[]'::jsonb)
  ) into result
  from public.library_share_links link
  join public.library_sets s on s.id = link.set_id
  where link.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > clock_timestamp())
    and s.status = 'ready';
  return result;
end;
$$;

create or replace function public.refresh_library_item_explanation(
  p_user_id uuid,
  p_item_id uuid,
  p_explanation text
)
returns public.library_items
language plpgsql
security definer
set search_path = ''
as $$
declare item_row public.library_items%rowtype;
begin
  if char_length(coalesce(p_explanation, '')) not between 1 and 10000 then
    raise exception 'explanation is required' using errcode = '22023';
  end if;
  update public.library_items i
  set content = jsonb_set(i.content, '{explanation}', to_jsonb(p_explanation), true)
  from public.library_sets s
  where i.id = p_item_id and i.set_id = s.id and s.creator_user_id = p_user_id
    and i.output_type = 'practice'
    and i.generation_version = (select max(current_item.generation_version) from public.library_items current_item where current_item.set_id = s.id and current_item.generation_version <= s.version)
  returning i.* into item_row;
  if not found then raise exception 'practice item not found' using errcode = 'P0002'; end if;
  return item_row;
end;
$$;

create or replace function public.bulk_edit_library_items(
  p_user_id uuid,
  p_set_id uuid,
  p_expected_version integer,
  p_title text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  set_row public.library_sets%rowtype;
  change_row jsonb;
  current_generation integer;
  remaining_count integer;
begin
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 160
    or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 100 then
    raise exception 'invalid library item changes' using errcode = '22023';
  end if;

  select * into set_row from public.library_sets where id = p_set_id for update;
  if not found or set_row.creator_user_id <> p_user_id then
    raise exception 'library set not found' using errcode = 'P0002';
  end if;
  if set_row.version <> p_expected_version then
    raise exception 'library set version conflict' using errcode = '40001';
  end if;
  if set_row.status <> 'ready' then
    raise exception 'library set cannot be edited' using errcode = 'P0001';
  end if;

  select max(generation_version) into current_generation
  from public.library_items where set_id = p_set_id and generation_version <= set_row.version;
  if current_generation is null then raise exception 'library items not found' using errcode = 'P0002'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_changes) change(value)
    where jsonb_typeof(change.value) <> 'object'
      or (change.value->>'id') is null
      or not exists (
        select 1 from public.library_items i
        where i.id = (change.value->>'id')::uuid and i.set_id = p_set_id and i.generation_version = current_generation
      )
  ) or exists (
    select 1 from jsonb_array_elements(p_changes) change(value)
    group by change.value->>'id' having count(*) > 1
  ) then
    raise exception 'library item not found' using errcode = 'P0002';
  end if;

  for change_row in select value from jsonb_array_elements(p_changes)
  loop
    if change_row->>'delete' = 'true' then
      delete from public.library_items
      where id = (change_row->>'id')::uuid and set_id = p_set_id and generation_version = current_generation;
    elsif jsonb_typeof(change_row->'content') = 'object' then
      update public.library_items
      set content = change_row->'content'
      where id = (change_row->>'id')::uuid and set_id = p_set_id and generation_version = current_generation;
    else
      raise exception 'invalid library item change' using errcode = '22023';
    end if;
  end loop;

  select count(*) into remaining_count from public.library_items where set_id = p_set_id and generation_version = current_generation;
  if remaining_count < 1 then raise exception 'a library set must retain at least one item' using errcode = '22023'; end if;
  update public.library_sets set version = version + 1, title = btrim(p_title), item_count = remaining_count where id = p_set_id returning * into set_row;
  return jsonb_build_object('setId', p_set_id, 'version', set_row.version, 'itemCount', remaining_count);
end;
$$;

revoke all on function public.create_library_generation(uuid, uuid, uuid, integer, text, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_library_job(uuid) from public, anon, authenticated;
revoke all on function public.finalize_library_generation(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_library_generation(uuid, text) from public, anon, authenticated;
revoke all on function public.reconcile_library_reservation() from public, anon, authenticated;
revoke all on function public.create_library_share_link(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_library_share_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_library_share_metadata(text) from public, anon, authenticated;
revoke all on function public.get_library_shared_set(text) from public, anon, authenticated;
revoke all on function public.refresh_library_item_explanation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.bulk_edit_library_items(uuid, uuid, integer, text, jsonb) from public, anon, authenticated;

grant execute on function public.create_library_generation(uuid, uuid, uuid, integer, text, text, integer, text, jsonb) to service_role;
grant execute on function public.claim_library_job(uuid) to service_role;
grant execute on function public.finalize_library_generation(uuid, jsonb) to service_role;
grant execute on function public.fail_library_generation(uuid, text) to service_role;
grant execute on function public.create_library_share_link(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.revoke_library_share_link(uuid, uuid) to service_role;
grant execute on function public.refresh_library_item_explanation(uuid, uuid, text) to service_role;
grant execute on function public.bulk_edit_library_items(uuid, uuid, integer, text, jsonb) to service_role;
grant execute on function public.get_library_share_metadata(text) to anon, authenticated;
grant execute on function public.get_library_shared_set(text) to authenticated;
grant execute on function public.get_library_share_metadata(text) to service_role;
