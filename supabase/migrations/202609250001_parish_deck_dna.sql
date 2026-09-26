-- Parish Deck DNA: custom Mass content master per parish.
-- LiturgyFlow keeps mass dividers; parishes style fonts/sizes/backgrounds.

alter table public.parishes
  add column if not exists deck_dna_path text,
  add column if not exists deck_dna_slide_map jsonb,
  add column if not exists deck_dna_updated_at timestamptz;

comment on column public.parishes.deck_dna_path is
  'Supabase storage path to parish deck DNA master.pptx';
comment on column public.parishes.deck_dna_slide_map is
  'Map of DNA slot key → list of 0-based slide indices in the uploaded master';
comment on column public.parishes.deck_dna_updated_at is
  'When parish deck DNA was last uploaded';
