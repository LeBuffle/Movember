-- =========================================================================
-- DEFI Movember — a category of its own for duels (story 12.7)
--
-- **Somebody who wants their daily reminder but not the duels has to be able
-- to say so.** Without a separate category the only way out is switching off
-- `resultat` or, worse, everything — and then they lose the message the whole
-- game depends on. That is exactly the failure story 6.7 exists to prevent,
-- and it would arrive by the back door.
--
-- One column, like the five before it: adding a category is a migration that
-- fails loudly if some code still expects the old shape, where a jsonb blob
-- would quietly return null and be read as "not interested".
-- =========================================================================

alter table public.notification_preferences
  add column if not exists cat_defi_joueur boolean not null default true;

comment on column public.notification_preferences.cat_defi_joueur is
  'Duels between players: received, met, expired, and the reminder before expiry (story 12.7).';
