import Link from "next/link";

import { ChallengeCard } from "@/components/game/challenge-card";
import {
  ParticipantShell,
  Panel,
  SectionHeading,
  StatRow,
} from "@/components/layout/participant-shell";
import { InstallReminder } from "@/components/pwa/install-reminder";
import { AddressReminder } from "@/components/shipping/address-reminder";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { ownSyncState } from "@/lib/activities/health";
import { getParticipantChallenges } from "@/lib/challenges/assignments";
import { todayInParis } from "@/lib/challenges/daily-draw";
import { EDITION_MILESTONES } from "@/lib/edition/calendar";
import { totalPoints } from "@/lib/challenges/progress";
import { getAlbum } from "@/lib/cards/collection";
import { pendingRevealCount } from "@/lib/cards/reveal";
import { openDuelCount } from "@/lib/duels/pending";
import { getShippingContext } from "@/lib/shipping/address";

/**
 * What the participant opens every morning.
 *
 * Ordered the way the question is asked: **what do I have to do today**, then
 * what is still open behind me, then what I have already done. A list sorted
 * by date alone would put a challenge from three days ago above today's on
 * the morning the draw runs late.
 *
 * The empty case is a real case, not an oversight to fill in later. The
 * morning the assignment fails, this screen has to say where things stand
 * rather than go blank — a participant staring at nothing concludes the game
 * is broken, and they are not entirely wrong.
 */
export default async function GameHome() {
  const today = todayInParis();

  const [shipping, challenges, sync, pendingCards, album, openDuels] =
    await Promise.all([
      getShippingContext(),
      getParticipantChallenges(30),
      ownSyncState(),
      pendingRevealCount(),
      getAlbum(),
      openDuelCount(),
    ]);

  // Cards held, packs included — this figure says what the album contains,
  // not what ranks. The ranking counter is a different one, on purpose
  // (architecture D8), and it lives on the collection screen.
  const cardsOwned = album.counters.collected;

  const todays = challenges.filter(
    (challenge) => challenge.assignedFor === today,
  );
  const stillOpen = challenges.filter(
    (challenge) =>
      challenge.status === "open" && challenge.assignedFor !== today,
  );
  const settled = challenges.filter(
    (challenge) =>
      challenge.status !== "open" && challenge.assignedFor !== today,
  );

  const score = totalPoints(challenges);
  const completed = challenges.filter(
    (challenge) => challenge.status === "completed",
  ).length;

  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(`${today}T12:00:00Z`));

  return (
    <ParticipantShell
      eyebrow={dayLabel}
      title={todays.length > 0 ? "Votre défi du jour" : "Vos défis"}
      intro="Rien à déclarer : vos activités valident vos défis toutes seules."
    >
      {/* Said plainly, because from where the participant stands a Strava
          outage and a broken game look exactly the same (story 3.9 AC 2).
          One sentence here saves thirty messages — and it is true: nothing
          marks a challenge missed during the edition, they stay open and
          settle when the outing finally arrives. */}
      {sync === "behind" && (
        <Alert tone="warning" title="Vos sorties tardent à remonter">
          La récupération depuis Strava est perturbée. Vos défis restent ouverts
          et se valideront tout seuls dès que vos sorties arriveront — vous
          n’avez rien à faire.
        </Alert>
      )}

      {sync === "broken" && (
        <Alert tone="danger" title="Votre compte Strava n’est plus relié">
          Vos sorties ne sont plus récupérées.{" "}
          <Link
            href="/mon-compte/activites"
            className="underline underline-offset-4"
          >
            Reconnectez votre compte
          </Link>{" "}
          pour que vos défis recomptent. Ce qui est déjà acquis le reste.
        </Alert>
      )}

      {/* The three figures that say where somebody stands, before anything
          else. Each is a way in rather than a decoration: points open the
          history, cards the album, the rank the leaderboard. */}
      <StatRow
        stats={[
          { value: String(score), label: "points", href: "/jeu/historique" },
          {
            value: String(completed),
            label: `défi${completed > 1 ? "s" : ""} réussi${completed > 1 ? "s" : ""}`,
            href: "/jeu/historique",
          },
          {
            value: String(cardsOwned),
            label: `carte${cardsOwned > 1 ? "s" : ""}`,
            href: "/jeu/collection",
          },
        ]}
      />

      {/* A card waiting to be opened is announced on the screen people open
          every morning, rather than discovered by chance two days later. */}
      {pendingCards > 0 && (
        <Panel className="border-brand-orange bg-brand-orange-soft">
          <p className="text-ink font-semibold">
            {pendingCards > 1
              ? `${pendingCards} cartes vous attendent`
              : "Une carte vous attend"}
          </p>
          <p className="text-ink-muted mt-1 text-sm">
            Gagnée en validant un défi. Elle rejoint votre collection une fois
            découverte.
          </p>
          <p className="mt-3">
            <Link href="/jeu/collection/reveler" className={buttonClasses()}>
              Découvrir
            </Link>
          </p>
        </Panel>
      )}

      {/* A duel received is running against a clock, and the clock does not
          stop for somebody who has not opened the right screen (story 12.7).
          Announced here, where people land every morning. */}
      {openDuels > 0 && (
        <Panel className="border-brand-blue bg-brand-blue-soft">
          <p className="text-ink font-semibold">
            {openDuels > 1
              ? `${openDuels} défis vous attendent`
              : "Un participant vous a défié"}
          </p>
          <p className="text-ink-muted mt-1 text-sm">
            Vous avez 24 heures pour le relever — et rien à perdre si vous ne le
            faites pas.
          </p>
          <p className="mt-3">
            <Link href="/jeu/defis-joueurs" className={buttonClasses()}>
              Voir mes défis
            </Link>
          </p>
        </Panel>
      )}

      {/* Brought back for whoever skipped the step at registration (story
          6.2 AC 4). Renders nothing once installed. */}
      <InstallReminder />

      <AddressReminder context={shipping} />

      {todays.length > 0 && (
        <section aria-labelledby="aujourdhui" className="space-y-3">
          <h2 id="aujourdhui" className="sr-only">
            Aujourd’hui
          </h2>
          {todays.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              today={today}
            />
          ))}
        </section>
      )}

      {todays.length === 0 && (
        <NoChallengeToday hasHistory={challenges.length > 0} />
      )}

      {stillOpen.length > 0 && (
        <section aria-labelledby="encore-ouverts" className="space-y-3">
          <SectionHeading>Encore jouables</SectionHeading>
          <p className="text-ink-muted -mt-1 text-sm">
            Un défi manqué ne bloque rien, et il reste validable : une activité
            plus tardive peut encore le compléter.
          </p>
          {stillOpen.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      )}

      {settled.length > 0 && (
        <section aria-labelledby="derriere-vous" className="space-y-3">
          <SectionHeading href="/jeu/historique">Déjà joués</SectionHeading>
          {settled.slice(0, 5).map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      )}

      <SectionHeading>Le reste du jeu</SectionHeading>
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            href: "/jeu/tableau-de-bord",
            title: "Mes chiffres",
            detail: "Totaux et rangs",
          },
          {
            href: "/jeu/actualites",
            title: "Actualités",
            detail: "Les messages de l’organisation",
          },
          {
            href: "/jeu/defis-joueurs",
            title: "Défis entre joueurs",
            detail: "Provoquer, relever, riposter",
          },
          {
            href: "/jeu/historique",
            title: "Mon historique",
            detail: "Tous mes défis",
          },
          {
            href: "/mon-compte",
            title: "Mon compte",
            detail: "Strava, notifications",
          },
        ].map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="border-line bg-surface hover:border-brand-blue rounded-2xl border p-4 transition-colors"
          >
            <span className="text-ink block font-semibold">{entry.title}</span>
            <span className="text-ink-muted mt-0.5 block text-sm">
              {entry.detail}
            </span>
          </Link>
        ))}
      </div>
    </ParticipantShell>
  );
}

/**
 * The morning without a challenge.
 *
 * Two very different situations, and telling them apart is the whole point:
 * before the game opens there is nothing to worry about, whereas a missing
 * challenge in the middle of November means something went wrong — and the
 * participant should not be left wondering whether it is their fault.
 */
function NoChallengeToday({ hasHistory }: { hasHistory: boolean }) {
  if (hasHistory) {
    return (
      <Alert tone="warning" title="Pas de défi pour aujourd’hui">
        Il n’a pas encore été attribué. Ce n’est pas de votre fait, et rien
        n’est perdu : revenez dans un moment, ou continuez sur vos défis encore
        jouables ci-dessous.
      </Alert>
    );
  }

  return (
    <>
      <Alert tone="info" title="Le jeu ouvre le 1ᵉʳ novembre">
        Votre premier défi arrivera ce matin-là. D’ici là, il n’y a rien à faire
        — et rien à rater.
      </Alert>

      <section aria-labelledby="jalons" className="space-y-3">
        <h2 id="jalons" className="text-ink text-xl font-bold">
          Les dates à retenir
        </h2>
        <ul className="border-line divide-line divide-y border-y">
          {EDITION_MILESTONES.map((milestone) => (
            <li
              key={milestone.date}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-x-4"
            >
              <time
                dateTime={milestone.date}
                className="text-brand-orange-ink font-semibold sm:w-40 sm:shrink-0"
              >
                {milestone.label}
              </time>
              <span className="text-ink">{milestone.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
