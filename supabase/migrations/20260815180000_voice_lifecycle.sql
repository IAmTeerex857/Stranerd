alter table public.voice_sessions drop constraint if exists voice_sessions_mode_check;
alter table public.voice_sessions add constraint voice_sessions_mode_check check (mode in ('app', 'mentor', 'lab', 'assessment', 'flashcard', 'notes'));
alter table public.voice_sessions drop constraint if exists voice_sessions_status_check;
alter table public.voice_sessions add constraint voice_sessions_status_check check (status in ('issued', 'ended', 'failed', 'expired'));
alter table public.voice_sessions add column if not exists ended_at timestamptz;
alter table public.voice_sessions add column if not exists end_reason text check (end_reason is null or char_length(end_reason) between 1 and 80);

create or replace function public.end_voice_session(p_user_id uuid, p_session_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('ended', 'failed', 'expired') or p_reason is null or char_length(p_reason) not between 1 and 80 then
    raise exception 'invalid voice end state' using errcode = '22023';
  end if;
  update public.voice_sessions
    set status = p_status, ended_at = clock_timestamp(), end_reason = p_reason
    where id = p_session_id and user_id = p_user_id and status = 'issued';
end; $$;

revoke all on function public.end_voice_session(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.end_voice_session(uuid, uuid, text, text) to service_role;
