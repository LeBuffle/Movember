import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDistance } from "@/lib/challenges/describe";
import type { ParticipantChallenge } from "@/lib/challenges/assignments";

/**
 * One challenge, as the participant sees it.
 *
 * The rule shown is **the same sentence the author validated** in the
 * back-office, produced by the same function. Two wordings — one for whoever
 * writes the challenge, one for whoever attempts it — is how a catalogue ends
 * up promising something the engine does not judge.
 *
 * A completed challenge says what completed it. "Réussi" alone invites the
 * message every organiser dreads: "réussi avec quoi ?"
 */
export function ChallengeCard({
  challenge,
}: {
  challenge: ParticipantChallenge;
}) {
  const done = challenge.status === "completed";

  return (
    <Card accent={done}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CardTitle>{challenge.title}</CardTitle>

        {done ? (
          <Badge tone="success">Réussi</Badge>
        ) : challenge.status === "missed" ? (
          <Badge tone="neutral">Manqué</Badge>
        ) : (
          <Badge tone="orange">En cours</Badge>
        )}
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

      <div className="border-line mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        <Badge tone="blue">
          {done
            ? (challenge.pointsAwarded ?? challenge.points)
            : challenge.points}{" "}
          points
        </Badge>

        {done && challenge.measured !== null && (
          <span className="text-ink-muted text-sm">
            Validé par une activité de {formatDistance(challenge.measured)}.
          </span>
        )}
      </div>
    </Card>
  );
}
