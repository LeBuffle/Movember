import {
  RemoveLogoForm,
  ReviewedForm,
} from "@/components/super-teams/logo-moderation";
import { TeamLogo } from "@/components/super-teams/team-logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { listLogos } from "@/lib/super-teams/moderation";
import {
  markLogoReviewedAction,
  removeLogoAction,
} from "@/lib/super-teams/moderation-actions";

export const metadata = {
  title: "Logos — back-office",
};

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Looking at the logos captains uploaded (story 14.6).
 *
 * **Moderation happens after the fact, and that is a decision** (epic 14,
 * S3). Approving every picture before it appears would land on three
 * volunteers at the exact moment registrations arrive in bulk, and a team
 * without its badge for three days is a team that gives up on the idea.
 *
 * **The screen is built to be finished.** What has not been looked at comes
 * first; what has, sinks below it. A flat list with no marker is a list you
 * re-read in full every day and stop reading on the third.
 */
export default async function AdminLogosPage() {
  const logos = await listLogos();
  const waiting = logos.filter((logo) => !logo.reviewedAt);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">Logos</h1>
        <p className="text-ink-muted mt-2">
          Les logos envoyés par les capitaines d’équipe et de super-équipe. Ils
          s’affichent tout de suite : cet écran sert à les relire ensuite, et à
          en retirer un si besoin.
        </p>
      </div>

      {logos.length === 0 ? (
        <Alert tone="info" title="Aucun logo pour l’instant">
          Ils apparaîtront ici dès qu’un capitaine en enverra un.
        </Alert>
      ) : (
        <>
          <Alert
            tone={waiting.length > 0 ? "warning" : "success"}
            title={
              waiting.length > 0
                ? `${waiting.length} logo${waiting.length > 1 ? "s" : ""} à relire`
                : "Tout est relu"
            }
          >
            {waiting.length > 0
              ? "Ils sont affichés en premier. Marquez-les comme vus une fois regardés."
              : "Les nouveaux logos remonteront en haut de cette liste."}
          </Alert>

          <ul className="space-y-3">
            {logos.map((logo) => (
              <li
                key={`${logo.kind}-${logo.id}`}
                className="border-line bg-surface flex flex-wrap items-start gap-4 rounded-xl border p-4"
              >
                <TeamLogo name={logo.name} url={logo.logoUrl} size="lg" />

                <div className="min-w-48 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-ink font-semibold">{logo.name}</p>

                    <Badge tone="neutral">
                      {logo.kind === "equipe" ? "Équipe" : "Super-équipe"}
                    </Badge>

                    {!logo.reviewedAt && <Badge tone="orange">À relire</Badge>}
                  </div>

                  <p className="text-ink-muted text-sm">
                    Envoyé par {logo.uploadedByName ?? "un compte supprimé"}
                    {logo.uploadedAt && (
                      <> · {dateFormat.format(new Date(logo.uploadedAt))}</>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    {!logo.reviewedAt && (
                      <ReviewedForm
                        action={markLogoReviewedAction}
                        kind={logo.kind}
                        id={logo.id}
                      />
                    )}

                    <RemoveLogoForm
                      action={removeLogoAction}
                      kind={logo.kind}
                      id={logo.id}
                      name={logo.name}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
