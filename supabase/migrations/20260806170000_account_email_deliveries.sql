create table public.account_email_deliveries (
  user_id uuid not null references auth.users (id) on delete cascade,
  template text not null check (template in ('welcome')),
  status text not null check (status in ('sending', 'sent', 'failed')),
  provider_id text,
  error text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, template)
);

create trigger account_email_deliveries_set_updated_at
before update on public.account_email_deliveries
for each row execute function public.set_updated_at();

alter table public.account_email_deliveries enable row level security;
revoke all on table public.account_email_deliveries from public, anon, authenticated;

create or replace function public.claim_account_email(p_user_id uuid, p_template text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.account_email_deliveries%rowtype;
begin
  if p_template <> 'welcome' then
    raise exception 'unsupported email template' using errcode = '22023';
  end if;

  insert into public.account_email_deliveries (user_id, template, status)
  values (p_user_id, p_template, 'sending')
  on conflict (user_id, template) do nothing
  returning * into delivery;

  if found then return true; end if;

  select * into delivery
  from public.account_email_deliveries
  where user_id = p_user_id and template = p_template
  for update;

  if delivery.status = 'failed' and delivery.attempt_count < 3 then
    update public.account_email_deliveries
    set status = 'sending', error = null, attempt_count = attempt_count + 1
    where user_id = p_user_id and template = p_template;
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.finish_account_email(
  p_user_id uuid,
  p_template text,
  p_status text,
  p_provider_id text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'invalid email status' using errcode = '22023';
  end if;
  update public.account_email_deliveries
  set status = p_status, provider_id = p_provider_id, error = p_error
  where user_id = p_user_id and template = p_template and status = 'sending';
end;
$$;

revoke all on function public.claim_account_email(uuid, text) from public, anon, authenticated;
revoke all on function public.finish_account_email(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_account_email(uuid, text) to service_role;
grant execute on function public.finish_account_email(uuid, text, text, text, text) to service_role;
