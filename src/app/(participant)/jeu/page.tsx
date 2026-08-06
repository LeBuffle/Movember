import Link from "next/link";

import { ChallengeCard } from "@/components/game/challenge-card";
import { AddressReminder } from "@/components/shipping/address-reminder";
import { Alert } from "@/components/ui/alert";
import { ownSyncState } from "@/lib/activities/health";
import { getParticipantChallenges } from "@/lib/challenges/assignments";
import { todayInParis } from "@/lib/challenges/daily-draw";
import { EDITION_MILESTONES, EDITION_YEAR } from "@/lib/edition/calendar";
import { totalPoints } from "@/lib/challenges/progress";
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

  const [shipping, challenges, sync] = await Promise.all([
    getShippingContext(),
    getParticipantChallenges(30),
    ownSyncState(),
  ]);

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

  return (
    <div className="space-y-8">
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-3xl font-bold tracking-tight">
            {todays.length > 0 ? "Votre défi du jour" : "Vos défis"}
          </h1>
          <p className="text-ink-muted mt-2">
            Édition {EDITION_YEAR}. Rien à déclarer : vos activités valident vos
            défis toutes seules.
          </p>
        </div>

        {completed > 0 && (
          <Link
            href="/jeu/historique"
            className="border-line bg-surface hover:border-brand-blue block rounded-xl border px-4 py-3 text-right transition-colors"
          >
            <span className="text-brand-orange-ink block text-2xl font-extrabold">
              {score} points
            </span>
            <span className="text-ink-muted block text-sm">
              {completed} défi{completed > 1 ? "s" : ""} réussi
              {completed > 1 ? "s" : ""} — voir l’historique
            </span>
          </Link>
        )}
      </div>

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
          <h2 id="encore-ouverts" className="text-ink text-xl font-bold">
            Encore jouables
          </h2>
          <p className="text-ink-muted text-sm">
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
          <h2 id="derriere-vous" className="text-ink text-xl font-bold">
            Déjà joués
          </h2>
          {settled.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      )}
    </div>
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
