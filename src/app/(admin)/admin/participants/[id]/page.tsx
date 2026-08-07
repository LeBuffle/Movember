import Link from "next/link";
import { notFound } from "next/navigation";

import { SuspensionForm } from "@/components/admin/suspension-form";
import { Badge } from "@/components/ui/badge";
import { getParticipant } from "@/lib/admin/participants";
import { formatEuros } from "@/lib/registration/tiers";

export const metadata = {
  title: "Fiche participant — back-office",
};

export const dynamic = "force-dynamic";

/**
 * One participant, seven sources, one screen (story 8.3).
 *
 * **Read-only, and deliberately so.** Corrections go through the screens that
 * record them — arbitrating a challenge (story 4.10), a refund (story 2.8),
 * a suspension (story 8.7). A screen that shows everything and edits
 * everything is a screen where mistakes happen, and none of them would be
 * traced.
 *
 * The address is reduced to a town and a country. The full one belongs on the
 * deliveries screen, which exists for the person packing parcels; every other
 * screen carrying it is one more place it can be read over a shoulder.
 */
export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const participant = await getParticipant(id);

  if (!participant) notFound();

  const {
    profile,
    registration,
    connection,
    challenges,
    cards,
    team,
    shipping,
    suspension,
  } = participant;

  const succeeded = challenges.filter(
    (challenge) => challenge.status === "completed",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link
            href="/admin/participants"
            className="underline underline-offset-4"
          >
            Participants
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          {profile.displayName}
        </h1>
        {suspension && (
          <p className="mt-2">
            <Badge tone="danger">Suspendu</Badge>
          </p>
        )}
        <p className="text-ink-muted mt-1 text-sm break-all">{profile.email}</p>
      </div>

      <Section title="Inscription">
        {registration ? (
          <dl className="space-y-2 text-sm">
            <Line label="Niveau">
              {registration.tierName ?? registration.tier ?? "—"}
            </Line>
            <Line label="État">
              <Badge
                tone={registration.status === "active" ? "success" : "orange"}
              >
                {registration.status}
              </Badge>
            </Line>
            <Line label="Montant">
              {registration.paidCents !== null
                ? formatEuros(registration.paidCents)
                : "—"}
            </Line>
            <Line label="Activée le">
              {registration.activatedAt
                ? formatMoment(registration.activatedAt)
                : "—"}
            </Line>
          </dl>
        ) : (
          <Empty>
            Aucune inscription pour l’édition en cours. Le jeu lui est refusé,
            et c’est le comportement voulu.
          </Empty>
        )}
      </Section>

      <Section title="Compte sportif">
        {connection ? (
          <dl className="space-y-2 text-sm">
            <Line label="Fournisseur">{connection.provider}</Line>
            <Line label="État">
              <Badge
                tone={connection.status === "broken" ? "danger" : "success"}
              >
                {connection.status === "broken" ? "rompue" : "active"}
              </Badge>
            </Line>
            <Line label="Reliée le">
              {formatMoment(connection.connectedAt)}
            </Line>
            <Line label="Dernière remontée">
              {connection.lastSyncedAt
                ? formatMoment(connection.lastSyncedAt)
                : "aucune"}
            </Line>
          </dl>
        ) : (
          <Empty>
            Aucun compte sportif relié. Ses défis ne peuvent pas se valider tout
            seuls — c’est la première chose à vérifier s’il signale un problème.
          </Empty>
        )}
      </Section>

      <Section title={`Défis — ${succeeded} réussi${succeeded > 1 ? "s" : ""}`}>
        {challenges.length === 0 ? (
          <Empty>Aucun défi attribué pour le moment.</Empty>
        ) : (
          <ul className="divide-line divide-y text-sm">
            {challenges.map((challenge) => (
              <li
                key={challenge.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-ink min-w-0">{challenge.title}</span>
                <span className="text-ink-muted flex shrink-0 items-center gap-2">
                  <span>{formatDay(challenge.assignedFor)}</span>
                  <Badge
                    tone={
                      challenge.status === "completed" ? "success" : "neutral"
                    }
                  >
                    {challenge.status}
                  </Badge>
                  {challenge.points > 0 && <span>{challenge.points} pts</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Cartes — ${cards.length}`}>
        {cards.length === 0 ? (
          <Empty>Aucune carte obtenue.</Empty>
        ) : (
          <ul className="divide-line divide-y text-sm">
            {cards.map((card, index) => (
              <li
                key={`${card.title}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-ink min-w-0">{card.title}</span>
                <span className="text-ink-muted flex shrink-0 items-center gap-2">
                  <Badge tone="neutral">{card.source}</Badge>
                  <span>{formatDay(card.grantedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Équipe">
        {team ? (
          <p className="text-ink text-sm">
            {team.name} · {team.role}
          </p>
        ) : (
          <Empty>Ne fait partie d’aucune équipe.</Empty>
        )}
      </Section>

      <Section title="Livraison">
        {shipping ? (
          <p className="text-ink text-sm">
            Adresse renseignée · {shipping.city}, {shipping.country}
            <span className="text-ink-muted block">
              L’adresse complète figure sur l’écran des livraisons.
            </span>
          </p>
        ) : (
          <Empty>
            Aucune adresse. Si son niveau comprend un envoi, elle sera à
            réclamer avant décembre.
          </Empty>
        )}
      </Section>

      {/* Last, and behind a first press. The rest of this screen is read a
          dozen times a day; this is used once a season, if ever. */}
      <Section title="Suspension">
        <SuspensionForm
          participantId={profile.id}
          suspended={suspension ? { ...suspension, by: null } : null}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line bg-surface rounded-xl border p-4">
      <h2 className="text-ink font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Line({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted text-sm">{children}</p>;
}

function formatMoment(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
