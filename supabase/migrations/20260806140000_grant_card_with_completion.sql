-- =========================================================================
-- DEFI Movember — completing a challenge and handing its card, together
-- (story 5.3)
--
-- **The point of attention of the whole epic**: an error partway through can
-- never leave a participant with a validated challenge and no card, nor hand
-- two cards for one challenge.
--
-- Two statements from the application cannot promise that. Whatever the
-- order, a failure between them leaves one of the two done — and the failure
-- that matters is a completed challenge with nothing to show for it, because
-- the participant sees the points, looks for the card, and writes in.
--
-- One function is one transaction. Either both happen, or neither does.
-- =========================================================================

create or replace function public.complete_challenge_with_card(
  p_assignment_id uuid,
  p_points integer,
  p_evidence jsonb,
  p_card_id uuid
)
returns table (completed boolean, card_id uuid)
language plpgsql
-- `security definer` so the function carries the write right rather than the
-- caller: `challenge_assignments` and `card_grants` have no write policy for
-- anybody, and that is what stops a participant awarding themselves the
-- month. The service-role client is the only caller, and it is already past
-- every other guard.
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_edition_id uuid;
  v_granted uuid;
begin
  -- The guard is carried by the write itself, not by a read a moment
  -- earlier: two activities arriving in the same millisecond would both pass
  -- a check, and only one can pass this.
  update public.challenge_assignments
     set status = 'completed',
         completed_at = now(),
         points_awarded = p_points,
         evidence = coalesce(p_evidence, '{}'::jsonb)
   where id = p_assignment_id
     and status = 'open'
  returning profile_id, edition_id into v_profile_id, v_edition_id;

  if v_profile_id is null then
    -- Somebody got there first. The challenge is completed and its card was
    -- handed out by whoever won the race — nothing to do, and above all no
    -- second card.
    return query select false, null::uuid;
    return;
  end if;

  -- A card is not always available: in September the catalogue is empty, and
  -- a challenge completed then must still be completed. A challenge without
  -- a card is a shame; a challenge that fails to validate is a bug.
  if p_card_id is not null then
    insert into public.card_grants (
      profile_id, edition_id, card_id, source, assignment_id
    )
    values (
      v_profile_id, v_edition_id, p_card_id, 'challenge', p_assignment_id
    )
    -- The unique index on `assignment_id` is what makes this replayable. A
    -- grant already there means this challenge already has its card.
    on conflict (assignment_id) where assignment_id is not null do nothing
    returning card_grants.card_id into v_granted;
  end if;

  return query select true, v_granted;
end;
$$;

comment on function public.complete_challenge_with_card is
  'Completes a challenge and grants its card in one transaction. Returns whether this call is the one that completed it.';

-- Only the service-role client calls this. `security definer` would
-- otherwise let any signed-in participant complete any challenge they can
-- name — which is precisely the hole the write policies were built to close.
revoke execute on function public.complete_challenge_with_card(
  uuid, integer, jsonb, uuid
) from public, anon, authenticated;
