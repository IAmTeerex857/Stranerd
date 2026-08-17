alter view public.material_subject_catalog set (security_invoker = false);

drop policy if exists material_sections_public_read on public.material_sections;
drop policy if exists material_assets_public_read on public.material_assets;
drop policy if exists material_figures_public_read on public.material_figures;
drop policy if exists material_mnemonics_public_read on public.material_mnemonics;
drop policy if exists material_flashcards_public_read on public.material_flashcards;
drop policy if exists material_questions_public_read on public.material_questions;

revoke select on public.material_subjects, public.material_releases, public.material_sections, public.material_assets, public.material_figures, public.material_mnemonics, public.material_flashcards, public.material_questions from anon, authenticated;
grant select (id, content_hash, status) on public.material_releases to authenticated;
grant select on public.material_subject_catalog to anon, authenticated;

update storage.buckets set public = false where id = 'materials';
drop policy if exists materials_storage_public_read on storage.objects;
