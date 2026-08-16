-- =========================================================================
-- DEFI Movember — the moment a card is discovered (story 5.5)
--
-- Challenges validate themselves from the activities that arrive; nobody
-- presses anything. That is the right design for the game and it costs the
-- one thing a collection lives on: the moment of opening. This column is what
-- puts it back — a card waits to be looked at before it joins the album.
-- =========================================================================

alter table public.card_grants
  add column revealed_at timestamptz;

comment on column public.card_grants.revealed_at is
  'When the participant actually looked at the card. Null means it is still waiting to be discovered (story 5.5).';

-- The queue: the cards waiting, oldest first. Partial, because a revealed
-- card is never looked up this way again — by the end of November the index
-- holds a handful of rows rather than nine thousand.
create index card_grants_pending_reveal_idx
  on public.card_grants (profile_id, granted_at)
  where revealed_at is null;

-- Anything handed out before this migration existed has already been seen in
-- the album. Without this line, a participant would come back to a queue of
-- everything they own — which is the opposite of a moment of discovery.
update public.card_grants
   set revealed_at = granted_at
 where revealed_at is null;

-- No new policy, deliberately.
--
-- `card_grants` still carries no write policy for anybody, and marking a card
-- as seen goes through the server with the service key. An update policy
-- would have to be written for a single column, and row level security
-- filters ROWS, not COLUMNS: a participant allowed to write `revealed_at`
-- would be allowed to write `source` in the same statement, and turn a card
-- bought in a pack into a card earned by playing. That column is the whole
-- integrity of the collection ranking (architecture D8).
