-- =========================================================================
-- DEFI Movember — the catch-up challenge (story 4.4)
--
-- What happens when the catalogue runs out for somebody.
--
-- Handing out nothing would be the worst possible answer: a participant opens
-- the application on a November morning and has nothing to do. So when every
-- remaining challenge has already been drawn for them, the rule against
-- repeating is relaxed — knowingly, and under a different name, so that the
-- accounts of what happened stay honest.
-- =========================================================================

alter table public.challenge_assignments
  drop constraint challenge_assignments_source_check;

alter table public.challenge_assignments
  add constraint challenge_assignments_source_check
  check (source in ('draw', 'common', 'manual', 'catchup'));

comment on column public.challenge_assignments.source is
  'draw: the daily individual draw. catchup: a repeat, because the catalogue ran out. common: imposed on everyone (story 4.8). manual: an administrator''s decision.';

-- One individual challenge per person per day — draw or catch-up.
--
-- The previous index covered `draw` alone, which was right when `draw` was
-- the only individual source. A catch-up is an individual challenge too, and
-- leaving it out would have let a replayed task hand somebody a second one on
-- exactly the day the catalogue was already failing them.
--
-- A common challenge (story 4.8) stays outside: it is shared by design and
-- sits alongside the individual one.
drop index if exists challenge_assignments_one_draw_per_day;

create unique index challenge_assignments_one_per_day
  on public.challenge_assignments (profile_id, assigned_for)
  where source in ('draw', 'catchup');

-- The "never the same challenge twice" rule still applies to draws only.
-- A catch-up IS a repeat — that is what it is for — and forbidding it here
-- would forbid the very thing the source exists to allow.
