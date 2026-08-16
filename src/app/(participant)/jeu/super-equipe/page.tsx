import Link from "next/link";
import { notFound } from "next/navigation";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { SuperTeamAppearanceForm } from "@/components/super-teams/logo-form";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { captainedSuperTeam } from "@/lib/super-teams/appearance";
import { setSuperTeamAppearanceAction } from "@/lib/super-teams/appearance-actions";

export const metadata = {
  title: "Ma super-équipe — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The appearance screen of a federation's captain (story 14.5).
 *
 * **Unreachable for everybody else, and not merely unlinked.** The federation
 * is found from the session — there is no identifier in the address to swap
 * for somebody else's — so typing this address as an ordinary participant
 * lands on a 404 rather than on another federation's form.
 *
 * Two fields, deliberately. The name, the composition and the captaincy
 * belong to the organisation: appearance comes undone in one click, while
 * detaching a team takes away its internal ranking in the middle of November
 * without telling anybody.
 */
export default async function OwnSuperTeamPage() {
  const superTeam = await captainedSuperTeam();

  if (!superTeam) notFound();

  return (
    <ParticipantShell
      title={superTeam.name}
      eyebrow="Ma super-équipe"
      intro="Vous en êtes le capitaine. Vous pouvez changer son logo et sa description."
    >
      <Card>
        <CardTitle>Apparence</CardTitle>
        <CardBody>
          <div className="mt-2">
            <SuperTeamAppearanceForm
              action={setSuperTeamAppearanceAction}
              name={superTeam.name}
              description={superTeam.description}
              logoUrl={superTeam.logoUrl}
            />
          </div>
        </CardBody>
      </Card>

      <p className="text-ink-muted text-sm">
        Le nom de la super-équipe et la liste des équipes qui la composent sont
        gérés par l’organisation. Écrivez-lui si l’un ou l’autre doit changer.
      </p>

      <p>
        <Link
          href={`/jeu/super-equipe/${superTeam.slug}`}
          className="text-brand-blue underline underline-offset-4"
        >
          Voir la page et le classement interne
        </Link>
      </p>
    </ParticipantShell>
  );
}
