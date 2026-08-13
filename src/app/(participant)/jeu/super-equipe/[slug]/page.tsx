import Link from "next/link";
import { notFound } from "next/navigation";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { TeamLogo } from "@/components/super-teams/team-logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getSuperTeamPage } from "@/lib/super-teams/read";
import { ownTeam } from "@/lib/teams/membership";

export const metadata = {
  title: "Super-équipe — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A federation's page, and its internal ranking (story 14.3).
 *
 * **One ranking is added; none is modified.** The standings come out of the
 * same function as the general team ranking, with the federation's teams
 * passed in — same normalisation, same stored exponent, same member
 * threshold, same tie handling. Only the ranks start again at 1, which is
 * what "internal" means.
 *
 * Readable by every participant, not only by members. A branch that is
 * thinking of joining should be able to see what it would be joining, and
 * there is nothing here that is not already public.
 */
export default async function SuperTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const own = await ownTeam();
  const page = await getSuperTeamPage(slug, own?.id ?? null);

  if (!page) notFound();

  const { standings } = page;

  return (
    <ParticipantShell title={page.name} eyebrow="Super-équipe">
      <div className="flex flex-wrap items-center gap-4">
        <TeamLogo name={page.name} url={page.logoUrl} size="lg" />

        <div>
          <h1 className="text-ink text-3xl font-bold tracking-tight">
            {page.name}
          </h1>
          <p className="text-ink-muted mt-1">
            {page.teamCount} équipe{page.teamCount > 1 ? "s" : ""} ·{" "}
            {page.memberCount} participant{page.memberCount > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {page.description && (
        <p className="text-ink whitespace-pre-line">{page.description}</p>
      )}

      <div className="border-line bg-surface grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
        <Figure value={String(page.points)} label="points au total" />
        <Figure
          value={String(page.challengesSucceeded)}
          label="défis réussis"
        />
        <Figure
          value={String(page.memberCount)}
          label={`participant${page.memberCount > 1 ? "s" : ""}`}
        />
      </div>

      <section aria-labelledby="classement-interne" className="space-y-3">
        <h2 id="classement-interne" className="text-ink text-xl font-bold">
          Le classement interne
        </h2>

        {standings.rows.length === 0 ? (
          <Alert tone="info" title="Pas encore de classement">
            {page.teamCount === 0
              ? "Aucune équipe n’est encore rattachée à cette super-équipe."
              : `Une équipe est classée à partir de ${standings.minMembers} membres, et dès ses premiers défis réussis.`}
          </Alert>
        ) : (
          <ul className="space-y-2">
            {standings.rows.map((row) => (
              <li
                key={row.teamId}
                className={
                  row.isOwn
                    ? "border-brand-orange bg-brand-orange-soft flex flex-wrap items-center gap-3 rounded-xl border p-3"
                    : "border-line bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-3"
                }
              >
                <span className="text-brand-orange-ink w-10 shrink-0 text-lg font-extrabold">
                  {row.rank}ᵉ
                </span>

                <TeamLogo name={row.name} url={row.logoUrl} size="sm" />

                <div className="min-w-32 flex-1">
                  <Link
                    href={`/jeu/equipe/${row.slug}`}
                    className="text-ink font-semibold underline underline-offset-4"
                  >
                    {row.name}
                  </Link>
                  <p className="text-ink-muted text-sm">
                    {row.memberCount} membre{row.memberCount > 1 ? "s" : ""} ·{" "}
                    {row.points} point{row.points > 1 ? "s" : ""}
                  </p>
                </div>

                {row.isOwn && <Badge tone="orange">Votre équipe</Badge>}
              </li>
            ))}
          </ul>
        )}

        {/* The rule, in a sentence anybody can argue with — and the same
            sentence as the general ranking, because it is the same rule. */}
        <p className="text-ink-muted text-sm">{page.normalisation}</p>
      </section>

      <p className="text-ink-muted text-sm">
        Ce classement compare les équipes de cette super-équipe entre elles. Il
        ne change rien au{" "}
        <Link
          href="/jeu/classement?categorie=equipes"
          className="underline underline-offset-4"
        >
          classement général des équipes
        </Link>
        , où chacune garde sa place.
      </p>
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
