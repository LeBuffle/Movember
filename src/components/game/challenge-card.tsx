import {
  ChallengeStatus,
  type ChallengeStatusValue,
} from "@/components/game/challenge-status";
import { Card } from "@/components/ui/card";
import type { ParticipantChallenge } from "@/lib/challenges/assignments";
import { challengeProgress } from "@/lib/challenges/progress";

/**
 * One challenge, as the participant sees it.
 *
 * **The screen they will open every morning for a month.** It deserves more
 * attention than its size suggests, and most of that attention went into
 * three things.
 *
 * The rule shown is **the same sentence the author validated** in the
 * back-office, produced by the same function. Two wordings — one for whoever
 * writes the challenge, one for whoever attempts it — is how a catalogue ends
 * up promising something the engine does not judge.
 *
 * The state is never carried by colour alone: `ChallengeStatus` pairs every
 * state with a word and a shape. Around one man in twelve has some form of
 * colour vision deficiency, and red/green is the common one — on a men's
 * health fundraiser, "green means done" would fail a real share of the people
 * it is for.
 *
 * A completed challenge says what completed it. "Réussi" alone invites the
 * message every organiser dreads: "réussi avec quoi ?"
 */

/** The database's vocabulary, mapped to the one the interface speaks. */
const STATUS: Record<ParticipantChallenge["status"], ChallengeStatusValue> = {
  open: "open",
  completed: "succeeded",
  missed: "failed",
};

export function ChallengeCard({
  challenge,
  today,
}: {
  challenge: ParticipantChallenge;
  /** Today's date, so the day's challenge can be named as such. */
  today?: string;
}) {
  const done = challenge.status === "completed";

  const progress = challenge.config
    ? challengeProgress(
        challenge.evaluator,
        challenge.config,
        challenge.measured,
      )
    : null;

  return (
    <Card accent={challenge.assignedFor === today && !done}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {challenge.source === "common" && (
            /* Named, because it changes what the challenge means: everybody
               has this one today, and that is the whole point of it. */
            <p className="text-brand-blue text-xs font-semibold tracking-wide uppercase">
              Défi commun — tout le monde l’a aujourd’hui
            </p>
          )}
          <h3 className="text-ink text-lg font-semibold">{challenge.title}</h3>
        </div>
        <ChallengeStatus status={STATUS[challenge.status]} />
      </div>

      {challenge.description && (
        <p className="text-ink-muted mt-2">{challenge.description}</p>
      )}

      {challenge.lines.length > 0 && (
        <ul className="text-ink mt-3 space-y-1 text-sm">
          {challenge.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {progress && <ProgressLine progress={progress} done={done} />}

      <div className="border-line text-ink-muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-sm">
        <span className="text-brand-orange-ink font-semibold">
          {done
            ? (challenge.pointsAwarded ?? challenge.points)
            : challenge.points}{" "}
          points
        </span>

        {done && challenge.measured !== null && progress && (
          <span>Validé avec {progress.measured}.</span>
        )}

        {challenge.arbitratedAt !== null && (
          /* Said to the participant too, not only in the back-office. A
             challenge decided by hand is a challenge whose points appeared
             or vanished without an activity to explain them — and a
             leaderboard that moves silently is one people stop trusting. */
          <span className="text-brand-orange-ink">
            Décidé par l’organisation.
          </span>
        )}
      </div>
    </Card>
  );
}

/**
 * The goal, and how far along it is when that is known.
 *
 * The bar only appears once something has been measured. Before that there is
 * a goal and no bar, rather than a bar stuck at zero — a bar that always
 * reads nothing teaches people to stop looking at it.
 */
function ProgressLine({
  progress,
  done,
}: {
  progress: NonNullable<ReturnType<typeof challengeProgress>>;
  done: boolean;
}) {
  const percent = Math.round((progress.ratio ?? 0) * 100);

  return (
    <div className="mt-3">
      <p className="text-ink-muted text-sm">
        {progress.measured === null ? (
          <>Objectif : {progress.target}</>
        ) : (
          <>
            <strong className="text-ink">{progress.measured}</strong> sur{" "}
            {progress.target}
          </>
        )}
      </p>

      {progress.ratio !== null && (
        <div
          className="border-line bg-surface-sunken mt-2 h-2 overflow-hidden rounded-full border"
          // Announced as a figure, because the bar itself says nothing to a
          // screen reader — and nothing at all to anyone on a monochrome
          // display.
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${progress.measured} sur ${progress.target}`}
        >
          <div
            className={done ? "bg-success h-full" : "bg-brand-blue h-full"}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
