update public.voice_sessions set ended_at=coalesce(ended_at,started_at),end_reason=coalesce(nullif(end_reason,''),'legacy_terminal') where status in ('ended','failed','expired') and (ended_at is null or end_reason is null);
update public.voice_sessions set ended_at=null,end_reason=null where status='issued' and (ended_at is not null or end_reason is not null);

alter table public.voice_sessions add constraint voice_sessions_terminal_metadata_check check ((status='issued' and ended_at is null and end_reason is null) or (status in ('ended','failed','expired') and ended_at is not null and ended_at>=started_at and end_reason is not null)) not valid;
alter table public.voice_sessions validate constraint voice_sessions_terminal_metadata_check;

create or replace function public.end_voice_session(p_user_id uuid,p_session_id uuid,p_status text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare session_row public.voice_sessions%rowtype; was_terminal boolean;
begin
  if p_status not in ('ended','failed','expired') or p_reason is null or char_length(p_reason) not between 1 and 80 then raise exception 'invalid voice end state' using errcode='22023'; end if;
  select * into session_row from public.voice_sessions where id=p_session_id and user_id=p_user_id for update;
  if not found then raise exception 'voice session not found' using errcode='P0002'; end if;
  was_terminal := session_row.status<>'issued';
  if not was_terminal then update public.voice_sessions set status=p_status,ended_at=clock_timestamp(),end_reason=p_reason where id=p_session_id returning * into session_row; end if;
  return;
end; $$;

revoke all on function public.end_voice_session(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.end_voice_session(uuid,uuid,text,text) to service_role;
