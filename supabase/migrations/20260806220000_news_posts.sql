-- =========================================================================
-- DEFI Movember — the news feed (story 7.8)
--
-- **The calm channel.** A notification interrupts; the feed waits to be read.
-- Keeping them separate is what stops every small announcement from becoming
-- an interruption — and interruptions are how people end up switching
-- notifications off altogether.
-- =========================================================================

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,

  title text not null check (char_length(title) between 2 and 120),
  body text not null default '',

  -- Reuses the `cartes` bucket's arrangement: a full public URL, so the feed
  -- renders it with a plain <img src> (story 5.6).
  image_path text not null default '',

  kind text not null default 'admin' check (kind in ('admin', 'auto')),

  -- Null means a draft. Nothing unpublished is ever readable by a
  -- participant, which is what makes it safe to write a message in advance.
  published_at timestamptz,

  -- Pinned posts sit at the top of the feed whatever their date.
  is_pinned boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.news_posts is
  'The feed participants read. Unpublished posts are invisible to them, so a message can be written in advance.';

-- The feed's own order: pinned first, then most recent.
create index news_posts_feed_idx
  on public.news_posts (edition_id, is_pinned desc, published_at desc)
  where published_at is not null;

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.news_posts enable row level security;

-- Published posts are readable by participants. Not by `anon`: the feed is
-- part of the game, not a public blog — an announcement about a challenge
-- means nothing to a visitor and would be indexed by search engines.
create policy "participants read published posts"
  on public.news_posts for select
  to authenticated
  using (published_at is not null);

create policy "admins read every post"
  on public.news_posts for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins write the feed"
  on public.news_posts for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
