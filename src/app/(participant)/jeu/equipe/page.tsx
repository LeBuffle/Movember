import Link from "next/link";

import { CreateTeamForm, JoinTeamForm } from "@/components/teams/team-forms";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { formatJoinCode } from "@/lib/teams/code";
import { createTeamAction, joinTeamAction } from "@/lib/teams/actions";
import { TEAM_KINDS } from "@/lib/teams/kinds";
import { ownTeam } from "@/lib/teams/membership";
import { absoluteUrl } from "@/lib/site-url";

export const metadata = {
  title: "Mon équipe — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where a participant joins a team, or starts one.
 *
 * **Teams are the main growth lever of this edition**: they are what lets a
 * club or a company come in as one block rather than one person at a time.
 * Everything on this screen serves the moment somebody is handed a code.
 *
 * Joining is offered before creating, because that is the common case — one
 * captain for every twenty members.
 */
export default async function TeamPage() {
  const team = await ownTeam();

  if (team) {
    const kind = TEAM_KINDS.find((entry) => entry.value === team.kind);

    return (
      <div className="space-y-6">
        <div>
          <p className="text-ink-muted text-sm">
            <Link href="/jeu" className="underline underline-offset-4">
              Le jeu
            </Link>
          </p>
          <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
            {team.name}
          </h1>
          <p className="text-ink-muted mt-2">
            {kind?.label} · {team.memberCount} membre
            {team.memberCount > 1 ? "s" : ""}
            {team.isCaptain ? " · vous en êtes le capitaine" : ""}
          </p>
        </div>

        {/* Only the captain, and it is the whole reason the join code lives
            behind its own read rule. Whoever holds it can join. */}
        {team.isCaptain && team.joinCode && (
          <Card accent>
            <CardTitle>Inviter dans l’équipe</CardTitle>
            <CardBody>
              <p>Donnez ce code à qui vous voulez faire entrer :</p>

              <p className="text-brand-orange-ink mt-3 font-mono text-3xl font-extrabold tracking-widest">
                {formatJoinCode(team.joinCode)}
              </p>

              <p className="mt-3 text-sm">
                Ou envoyez ce lien :{" "}
                <span className="break-all">
                  {absoluteUrl(`/jeu/equipe?code=${team.joinCode}`)}
                </span>
              </p>

              <p className="text-ink-muted mt-3 text-sm">
                Vous seul voyez ce code. Les codes ne contiennent jamais de O,
                de I, de L, de 0 ni de 1 — pour qu’ils se lisent à voix haute
                sans se tromper.
              </p>
            </CardBody>
          </Card>
        )}

        <Alert tone="info" title="Le classement d’équipe arrive">
          Il sera normalisé par le nombre de membres : une équipe de cinq ne
          sera pas mécaniquement battue par une équipe de cinquante.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/jeu" className="underline underline-offset-4">
            Le jeu
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Mon équipe
        </h1>
        <p className="text-ink-muted mt-2">
          Jouer en équipe ne change rien à vos défis : vous gardez les vôtres.
          C’est un classement de plus, et une raison de s’encourager.
        </p>
      </div>

      <Card>
        <CardTitle>J’ai un code</CardTitle>
        <CardBody>
          <div className="mt-2">
            <JoinTeamForm action={joinTeamAction} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardTitle>Je crée mon équipe</CardTitle>
        <CardBody>
          <p className="text-sm">
            Vous en devenez le capitaine et recevez un code à partager.
          </p>
          <div className="mt-4">
            <CreateTeamForm action={createTeamAction} />
          </div>
        </CardBody>
      </Card>

      <p className="text-ink-muted text-sm">
        Vous ne pouvez appartenir qu’à une seule équipe par édition — sans quoi
        le classement d’équipe ne voudrait plus rien dire.
      </p>
    </div>
  );
}
