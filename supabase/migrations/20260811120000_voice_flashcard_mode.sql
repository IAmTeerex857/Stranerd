alter table public.voice_sessions
  drop constraint if exists voice_sessions_mode_check;

alter table public.voice_sessions
  add constraint voice_sessions_mode_check
  check (mode in ('mentor', 'lab', 'assessment', 'flashcard'));
