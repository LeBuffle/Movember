"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { JournalEntry } from "@/lib/activities/journal";
import type { JournalState } from "@/lib/activities/journal-actions";
import { SPORT_FAMILY_LABELS } from "@/lib/challenges/sports";
import { formatValue } from "@/lib/leaderboards/categories";

/**
 * Les dernières sorties de quelqu'un, dépliées depuis sa ligne (story 15.4).
 *
 * **Chargé à l'ouverture, jamais avant.** Cinquante lignes de classement qui
 * chargeraient cinquante journaux feraient cinquante lectures pour une seule
 * qui sera lue.
 *
 * **Un bouton, pas une carte cliquable.** Une ligne entière cliquable est
 * invisible pour qui navigue au clavier, et le classement est déjà passé à la
 * revue d'accessibilité de la story 11.7.
 *
 * Le bouton disparaît une fois chargé, remplacé par la liste : ce n'est donc
 * pas un `aria-expanded` — rien ne se replie — mais une zone `aria-live`, pour
 * qu'un lecteur d'écran annonce ce qui vient d'apparaître au lieu de laisser
 * le focus dans le vide.
 */

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function OpenButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="text-brand-blue min-h-11 text-sm font-semibold underline-offset-4 hover:underline"
    >
      {pending ? "Chargement…" : label}
    </button>
  );
}

function Entries({ entries }: { entries: JournalEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-ink-muted text-sm">
        Aucune sortie dans cette catégorie pour l’instant.
      </p>
    );
  }

  return (
    <ul className="divide-line divide-y text-sm">
      {entries.map((entry, index) => (
        <li
          key={`${entry.localDate}-${index}`}
          className="flex flex-wrap items-baseline justify-between gap-x-3 py-2"
        >
          <span className="text-ink">
            {dayFormat.format(new Date(`${entry.localDate}T12:00:00`))}
            <span className="text-ink-muted">
              {" "}
              · {SPORT_FAMILY_LABELS[entry.sportFamily]}
            </span>
          </span>

          <span className="text-ink-muted tabular-nums">
            {entry.distanceMeters > 0 && (
              <>{formatValue(entry.distanceMeters, "metres")} · </>
            )}
            {formatValue(entry.durationSeconds, "seconds")}
            {entry.elevationMeters > 0 && <> · {entry.elevationMeters} m D+</>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityJournal({
  action,
  profileId,
  category,
  displayName,
  isSelf,
  showsActivities,
}: {
  action: (previous: JournalState, formData: FormData) => Promise<JournalState>;
  profileId: string;
  category: string;
  displayName: string;
  isSelf: boolean;
  showsActivities: boolean;
}) {
  const [state, formAction] = useActionState<JournalState, FormData>(
    action,
    {},
  );

  // Le réglage est connu avant l'ouverture : proposer un dépliant qui
  // s'ouvrirait sur du vide se lit comme une panne.
  if (!showsActivities) {
    return isSelf ? (
      <p className="text-ink-muted mt-2 text-sm">
        Vos sorties ne sont pas montrées aux autres. Vous pouvez changer cela
        depuis « Mon compte ».
      </p>
    ) : null;
  }

  const opened = state.journal !== undefined;

  return (
    <div className="mt-2" aria-live="polite">
      {!opened && (
        <form action={formAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="categorie" value={category} />

          <OpenButton
            label={
              isSelf
                ? "Voir mes dernières sorties"
                : "Voir ses dernières sorties"
            }
          />
        </form>
      )}

      {state.journal?.state === "ok" && (
        <div className="mt-2">
          <Entries entries={state.journal.entries} />
        </div>
      )}

      {/* Un choix, pas un incident — et le ton doit le dire, sinon on insiste. */}
      {state.journal?.state === "hidden" && (
        <p className="text-ink-muted mt-2 text-sm">
          {displayName} ne montre pas ses sorties.
        </p>
      )}

      {state.journal?.state === "unavailable" && (
        <p className="text-ink-muted mt-2 text-sm">
          Ces sorties ne sont pas consultables.
        </p>
      )}

      {isSelf && opened && (
        <p className="text-ink-muted mt-2 text-sm">
          C’est ce que les autres voient de vous. Réglable depuis « Mon compte
          ».
        </p>
      )}
    </div>
  );
}
