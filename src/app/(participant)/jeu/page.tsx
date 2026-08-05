import { ChallengeCard } from "@/components/game/challenge-card";
import { AddressReminder } from "@/components/shipping/address-reminder";
import { Alert } from "@/components/ui/alert";
import { EDITION_MILESTONES, EDITION_YEAR } from "@/lib/edition/calendar";
import { getParticipantChallenges } from "@/lib/challenges/assignments";
import { getShippingContext } from "@/lib/shipping/address";

/**
 * The participant's home inside the game.
 *
 * Empty on purpose. Epic 4 puts the day's challenge here, epic 5 the cards,
 * epic 7 the leaderboards. What already exists — and is the point of this
 * story — is everything around it: only a participant whose payment has been
 * confirmed by the webhook ever reaches this page.
 */
export default async function GameHome() {
  const [shipping, challenges] = await Promise.all([
    getShippingContext(),
    getParticipantChallenges(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Votre inscription est active
        </h1>
        <p className="text-ink-muted mt-2">
          Tout est en ordre : votre paiement est confirmé et votre place pour
          l’édition {EDITION_YEAR} est réservée.
        </p>
      </div>

      <AddressReminder context={shipping} />

      {challenges.length > 0 ? (
        <section aria-labelledby="defis" className="space-y-3">
          <h2 id="defis" className="text-ink text-xl font-bold">
            Vos défis
          </h2>

          <div className="space-y-3">
            {challenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      ) : (
        <Alert tone="info" title="Le jeu ouvre le 1ᵉʳ novembre">
          Les défis quotidiens, les cartes et les classements arriveront ici.
          D’ici là, il n’y a rien à faire — et rien à rater.
        </Alert>
      )}

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
    </div>
  );
}
