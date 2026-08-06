import {
  AdminCreateTeamForm,
  AssignCaptainForm,
} from "@/components/admin/team-admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatJoinCode } from "@/lib/teams/code";
import { TEAM_KINDS } from "@/lib/teams/kinds";
import {
  adminAssignCaptainAction,
  adminCreateTeamAction,
} from "@/lib/teams/manage-actions";
import { listTeams, teamMembers } from "@/lib/teams/manage";

export const metadata = {
  title: "Équipes — back-office",
};

export const dynamic = "force-dynamic";

/**
 * The teams of the edition, as the organisation sees them.
 *
 * Two jobs, and only two. Creating a team for a company that asks before
 * anybody has registered (FR78) — and handing that team over to its real
 * captain once their contact has an account.
 *
 * **Everything else is the captain's.** The organisation could technically
 * exclude members or rename teams from here; it deliberately cannot. A
 * captain who discovers their team was reorganised by somebody else stops
 * recruiting, and recruiting is what teams are for.
 */
export default async function AdminTeamsPage() {
  const teams = await listTeams();

  const membersByTeam = new Map(
    await Promise.all(
      teams.map(async (team) => [team.id, await teamMembers(team.id)] as const),
    ),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">Équipes</h1>
        <p className="text-ink-muted mt-2">
          Les équipes se créent d’elles-mêmes : un participant crée la sienne et
          invite avec un code. Cet écran sert au cas où une entreprise demande
          son équipe avant que quiconque soit inscrit.
        </p>
      </div>

      <section className="border-line bg-surface space-y-4 rounded-xl border p-4">
        <h2 className="text-ink text-lg font-bold">
          Créer une équipe pour une entreprise
        </h2>
        <p className="text-ink-muted text-sm">
          Vous en serez capitaine sur le papier, le temps que leur contact ait
          un compte.
        </p>

        <AdminCreateTeamForm action={adminCreateTeamAction} />
      </section>

      {teams.length === 0 ? (
        <Alert tone="info" title="Aucune équipe pour l’instant">
          Elles apparaîtront ici dès que les participants en créeront.
        </Alert>
      ) : (
        <section className="space-y-3">
          <h2 className="text-ink text-lg font-bold">
            {teams.length} équipe{teams.length > 1 ? "s" : ""}
          </h2>

          <ul className="space-y-3">
            {teams.map((team) => (
              <li
                key={team.id}
                className="border-line bg-surface space-y-3 rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-ink font-semibold">{team.name}</p>
                    <p className="text-ink-muted mt-1 text-sm">
                      Capitaine : {team.captainName} · {team.memberCount} membre
                      {team.memberCount > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">
                      {TEAM_KINDS.find((entry) => entry.value === team.kind)
                        ?.label ?? team.kind}
                    </Badge>
                    <span className="text-ink-muted font-mono text-sm">
                      {formatJoinCode(team.joinCode)}
                    </span>
                  </div>
                </div>

                <AssignCaptainForm
                  action={adminAssignCaptainAction}
                  teamId={team.id}
                  members={membersByTeam.get(team.id) ?? []}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
