import Link from "next/link";

import {
  AssignSuperCaptainForm,
  AttachTeamForm,
  CreateSuperTeamForm,
  DeleteSuperTeamForm,
  DetachTeamForm,
} from "@/components/super-teams/super-team-admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  assignSuperCaptainAction,
  attachTeamAction,
  createSuperTeamAction,
  deleteSuperTeamAction,
  detachTeamAction,
} from "@/lib/super-teams/manage-actions";
import {
  attachableTeams,
  attachedTeams,
  listSuperTeams,
  superTeamMembers,
} from "@/lib/super-teams/manage";

export const metadata = {
  title: "Super-équipes — back-office",
};

export const dynamic = "force-dynamic";

/**
 * The federations, as the organisation sees them (story 14.2).
 *
 * **Everything about a super team is here, and nothing about it is anywhere
 * else.** A participant cannot create one, attach a team to one, or name its
 * captain — by decision, not by omission. The super team's own captain gets
 * the appearance screen of story 14.5 and that is the whole of their power.
 *
 * A super team sits above teams and changes nothing below it: joining by
 * code, the captain's authority over their own team, the general ranking.
 */
export default async function AdminSuperTeamsPage() {
  const superTeams = await listSuperTeams();

  const [free, details] = await Promise.all([
    attachableTeams(),
    Promise.all(
      superTeams.map(async (superTeam) => ({
        id: superTeam.id,
        teams: await attachedTeams(superTeam.id),
        members: await superTeamMembers(superTeam.id),
      })),
    ),
  ]);

  const byId = new Map(details.map((entry) => [entry.id, entry]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Super-équipes
        </h1>
        <p className="text-ink-muted mt-2">
          Une super-équipe regroupe plusieurs équipes — une fédération et ses
          antennes locales. Elle leur donne un classement interne et une
          identité commune. La gestion des équipes elles-mêmes ne change pas.
        </p>
      </div>

      <section className="border-line bg-surface space-y-4 rounded-xl border p-4">
        <h2 className="text-ink text-lg font-bold">Créer une super-équipe</h2>
        <p className="text-ink-muted text-sm">
          Vous seul pouvez en créer une, y rattacher des équipes et nommer son
          capitaine.
        </p>

        <CreateSuperTeamForm action={createSuperTeamAction} />
      </section>

      {superTeams.length === 0 ? (
        <Alert tone="info" title="Aucune super-équipe pour l’instant">
          Créez-en une ci-dessus, puis rattachez-lui les équipes de la
          fédération.
        </Alert>
      ) : (
        <section className="space-y-4">
          <h2 className="text-ink text-lg font-bold">
            {superTeams.length} super-équipe{superTeams.length > 1 ? "s" : ""}
          </h2>

          <ul className="space-y-4">
            {superTeams.map((superTeam) => {
              const detail = byId.get(superTeam.id);

              return (
                <li
                  key={superTeam.id}
                  className="border-line bg-surface space-y-4 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-ink font-semibold">{superTeam.name}</p>
                      <p className="text-ink-muted mt-1 text-sm">
                        {superTeam.teamCount} équipe
                        {superTeam.teamCount > 1 ? "s" : ""} ·{" "}
                        {superTeam.memberCount} participant
                        {superTeam.memberCount > 1 ? "s" : ""}
                      </p>
                    </div>

                    {superTeam.captainName ? (
                      <Badge tone="orange">
                        Capitaine : {superTeam.captainName}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Sans capitaine</Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="text-ink text-sm font-semibold">
                      Équipes rattachées
                    </h3>

                    {detail && detail.teams.length > 0 ? (
                      <ul className="divide-line mt-2 divide-y">
                        {detail.teams.map((team) => (
                          <li
                            key={team.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2"
                          >
                            <Link
                              href={`/jeu/equipe/${team.slug}`}
                              className="text-ink underline underline-offset-4"
                            >
                              {team.name}
                            </Link>

                            <DetachTeamForm
                              action={detachTeamAction}
                              teamId={team.id}
                              teamName={team.name}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-ink-muted mt-2 text-sm">
                        Aucune équipe rattachée pour l’instant.
                      </p>
                    )}
                  </div>

                  <AttachTeamForm
                    action={attachTeamAction}
                    superTeamId={superTeam.id}
                    teams={free}
                  />

                  <AssignSuperCaptainForm
                    action={assignSuperCaptainAction}
                    superTeamId={superTeam.id}
                    members={detail?.members ?? []}
                  />

                  <DeleteSuperTeamForm
                    action={deleteSuperTeamAction}
                    superTeamId={superTeam.id}
                    name={superTeam.name}
                    teamCount={superTeam.teamCount}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
