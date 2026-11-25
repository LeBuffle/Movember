-- =========================================================================
-- DEFI Movember — card visuals and the "never delete a published card" rule
-- (story 5.6)
--
-- The two things the back-office needs before a volunteer can publish a card
-- from their phone in November: somewhere to put the picture, and a database
-- that refuses the one destructive action this screen offers.
-- =========================================================================

-- -------------------------------------------------------------------------
-- The bucket
--
-- **Public on purpose.** A published card is public anyway — the album shows
-- what is missing, and the gallery of story 5.8 shows the lot — so serving
-- the pictures straight from storage costs nothing, needs no signing, and
-- caches at the CDN. A private bucket would mean minting a signed URL for
-- every thumbnail on a screen that shows fifty of them.
--
-- The consequence, stated rather than hidden: the visual of a card that is
-- not published yet is readable by anyone who knows its address. The address
-- is a random identifier that appears nowhere before publication, which is
-- enough for a surprise — it would not be enough for a secret, and nothing
-- secret goes in here.
--
-- The limits are set on the bucket as well as in the application. The
-- application check gives the volunteer a sentence they can act on; this one
-- is what actually holds if a request ever arrives another way.
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cartes',
  'cartes',
  true,
  2097152, -- 2 MiB. A card is a thumbnail, not a poster.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------------------------------------------------
-- Who may write a picture
--
-- Administrators, through their own session — the same rule as the challenge
-- catalogue. Uploading with the service key would make this file the only
-- thing standing between a crafted request and the bucket.
--
-- Dropped first because storage policies are shared with everything else in
-- the project, and because this migration may well be run twice by hand.
-- -------------------------------------------------------------------------
drop policy if exists "admins upload card images" on storage.objects;
drop policy if exists "admins replace card images" on storage.objects;
drop policy if exists "admins remove card images" on storage.objects;

create policy "admins upload card images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cartes' and (select public.is_admin()));

create policy "admins replace card images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'cartes' and (select public.is_admin()))
  with check (bucket_id = 'cartes' and (select public.is_admin()));

create policy "admins remove card images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'cartes' and (select public.is_admin()));

-- No read policy: a public bucket is served without one. Adding a select
-- policy here would suggest the bucket is private, which it is not.

-- -------------------------------------------------------------------------
-- A published card is never deleted (story 5.6 AC 4)
--
-- **Enforced by the database, not by the screen.** Someone holds that card in
-- their album; deleting it would take a completed challenge out of their
-- history. The foreign key already refuses once a card has been handed out
-- (`on delete restrict` on `card_grants`), but that leaves a window: a card
-- published this morning and drawn by nobody yet would delete cleanly, and
-- reappear as a hole in the collection of the first person to be shown it.
--
-- Publication is the point of no return, not the first grant.
-- -------------------------------------------------------------------------
create function public.forbid_published_card_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception 'A published card cannot be deleted (card %)', old.id
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

create trigger cards_no_delete_once_published
  before delete on public.cards
  for each row execute function public.forbid_published_card_delete();

comment on function public.forbid_published_card_delete() is
  'Publication is irreversible as far as deletion goes: an unpublished card can be removed, a published one never (story 5.6 AC 4).';
