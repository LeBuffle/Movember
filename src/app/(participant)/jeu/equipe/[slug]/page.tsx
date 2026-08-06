import Link from "next/link";
import { notFound } from "next/navigation";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { getTeamLeaderboard } from "@/lib/leaderboards/teams";
import { createAnonClient } from "@/lib/supabase/anon";
import { formatJoinCode } from "@/lib/teams/code";
import { TEAM_KINDS } from "@/lib/teams/kinds";
import { teamMembers } from "@/lib/teams/manage";
import { ownTeam } from "@/lib/teams/membership";

export const metadata = {
  title: "Équipe — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A team's own page.
 *
 * **The invitation code is visible to the captain and to nobody else** (AC 4)
 * — they are the one who decides who comes in. Everything else is the same
 * for every reader, member or not: members by pseudonym, progress, rank.
 *
 * Reached by slug rather than by identifier, so the address is something a
 * captain can read out. The team is looked up through `public_teams`, which
 * carries no join code at all — the code shown further down comes from the
 * reader's own membership, not from this lookup.
 */
export default async function TeamPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAnonClient();

  if (!supabase) notFound();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) notFound();

  const { data: team } = await supabase
    .from("public_teams")
    .select("id, name, slug, kind")
    .eq("edition_id", edition.id)
    .eq("slug", slug)
    .maybeSingle();

  if (!team) notFound();

  const [members, own, board] = await Promise.all([
    teamMembers(team.id),
    ownTeam(),
    getTeamLeaderboard(),
  ]);

  const standing = board.rows.find((row) => row.teamId === team.id);
  const isOwnTeam = own?.id === team.id;
  const kind = TEAM_KINDS.find((entry) => entry.value === team.kind);

  return (
    <ParticipantShell title={team.name} eyebrow="Équipe">
      <div>
        <p className="text-ink-muted text-sm">
          <Link
            href="/jeu/classement?categorie=equipes"
            className="underline underline-offset-4"
          >
            Classement des équipes
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          {team.name}
        </h1>
        <p className="text-ink-muted mt-2">
          {kind?.label} · {members.length} membre{members.length > 1 ? "s" : ""}
        </p>
      </div>

      {standing ? (
        <div className="border-line bg-surface grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
          <Figure value={`${standing.rank}ᵉ`} label="au classement d’équipe" />
          <Figure value={String(standing.points)} label="points au total" />
          <Figure
            value={String(standing.challengesSucceeded)}
            label="défis réussis"
          />
        </div>
      ) : (
        <Alert tone="info" title="Cette équipe n’est pas encore classée">
          Une équipe est classée à partir de {board.minMembers} membres, et dès
          ses premiers défis réussis.
        </Alert>
      )}

      {/* Only the captain, and only on their own team. Whoever holds the code
          can join, so it is theirs to give. */}
      {isOwnTeam && own?.isCaptain && own.joinCode && (
        <div className="border-brand-orange bg-brand-orange-soft rounded-xl border p-4">
          <p className="text-ink font-semibold">Inviter dans l’équipe</p>
          <p className="text-brand-orange-ink mt-2 font-mono text-2xl font-extrabold tracking-widest">
            {formatJoinCode(own.joinCode)}
          </p>
          <p className="text-ink-muted mt-2 text-sm">
            Vous seul voyez ce code.
          </p>
        </div>
      )}

      <section aria-labelledby="membres" className="space-y-3">
        <h2 id="membres" className="text-ink text-xl font-bold">
          Les membres
        </h2>

        {members.length === 0 ? (
          <Alert tone="info" title="Personne n’a encore rejoint">
            Cette équipe vient d’être créée.
          </Alert>
        ) : (
          <ul className="border-line divide-line divide-y border-y">
            {members.map((member) => (
              <li
                key={member.profileId}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="text-ink font-medium">
                  {member.displayName}
                  {member.isSelf && (
                    <span className="text-ink-muted font-normal"> — vous</span>
                  )}
                </span>

                {member.role === "capitaine" && (
                  <Badge tone="orange">Capitaine</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwnTeam && (
        <p>
          <Link
            href="/jeu/equipe"
            className={buttonClasses({ variant: "ghost" })}
          >
            Gérer mon équipe
          </Link>
        </p>
      )}
    </ParticipantShell>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-brand-orange-ink text-2xl font-extrabold">{value}</p>
      <p className="text-ink-muted mt-1 text-sm">{label}</p>
    </div>
  );
}
