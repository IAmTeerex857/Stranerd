alter table public.flashcard_decks alter column card_count set default 15;
alter table public.flashcard_decks drop constraint if exists flashcard_decks_card_count_check;
alter table public.flashcard_decks add constraint flashcard_decks_card_count_check check (card_count in (12, 15));

alter table public.flashcard_deck_content drop constraint if exists flashcard_deck_content_cards_check;
alter table public.flashcard_deck_content add constraint flashcard_deck_content_cards_check
  check (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) in (12, 15));

create or replace function public.stage_generated_flashcard_deck(p_deck_id uuid, p_user_id uuid, p_request_id uuid, p_reservation_id uuid, p_model_id text, p_title text, p_description text, p_visibility text, p_content_version text, p_cards jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing_id uuid;
begin
  select id into existing_id from public.flashcard_decks where generation_request_id = p_request_id;
  if found then return existing_id; end if;
  if p_visibility not in ('private', 'public') or jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) <> 15 then raise exception 'invalid generated deck' using errcode = '22023'; end if;
  if not exists (select 1 from public.credit_reservations where id = p_reservation_id and user_id = p_user_id and request_id = p_request_id::text and feature = 'ai_flashcards' and amount = 5 and status = 'reserved') then raise exception 'valid reservation required' using errcode = 'P0001'; end if;
  insert into public.flashcard_decks (id, owner_user_id, model_id, title, description, visibility, card_count, generation_request_id, reservation_id) values (p_deck_id, p_user_id, p_model_id, p_title, p_description, p_visibility, 15, p_request_id, p_reservation_id);
  insert into public.flashcard_deck_content (deck_id, content_version, cards) values (p_deck_id, p_content_version, p_cards);
  return p_deck_id;
end; $$;

create or replace function public.activate_generated_flashcard_deck()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.feature = 'ai_flashcards' and old.status = 'reserved' and new.status = 'spent' then
    if not exists (
      select 1 from public.flashcard_decks d join public.flashcard_deck_content c on c.deck_id = d.id
      where d.reservation_id = new.id and d.card_count = jsonb_array_length(c.cards) and d.card_count in (12, 15)
    ) then raise exception 'generated deck content missing'; end if;
    update public.flashcard_decks set status = 'ready' where reservation_id = new.id;
  elsif new.feature = 'ai_flashcards' and new.status in ('refunded', 'expired') then
    update public.flashcard_decks set status = 'failed' where reservation_id = new.id and status = 'pending';
  end if;
  return new;
end; $$;
