import { Badge } from "@/components/ui/badge";
import {
  COLLECTIVE_GOALS,
  EDITION_YEAR,
  PREVIOUS_EDITION,
} from "@/lib/edition/calendar";
import type { CollectiveTotals } from "@/lib/leaderboards/collective";

function Figure({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-brand-blue text-3xl font-extrabold tracking-tight">
        {value}
      </p>
      <p className="text-ink mt-1 font-medium">{label}</p>
      {detail && <p className="text-ink-muted mt-0.5 text-sm">{detail}</p>}
    </div>
  );
}

const number = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

/**
 * What the previous edition achieved, and what this one aims for.
 *
 * The place the live counter will occupy (AC 5). It is not filled with
 * invented current figures: a counter showing a number nobody collected
 * would be the one thing on this page a visitor could catch us on. The past
 * edition's numbers are real, and the targets are labelled as targets.
 *
 * The two derived figures are the interesting ones — 12,50 € per person and
 * seventeen minutes of sport a day. They turn "5 000 € and 3 500 hours",
 * which means nothing to a newcomer, into something they can picture
 * themselves doing.
 */
export function CollectiveFigures({ live }: { live?: CollectiveTotals }) {
  const perParticipant = (
    PREVIOUS_EDITION.amountEuros / PREVIOUS_EDITION.participants
  ).toLocaleString("fr-FR", { minimumFractionDigits: 2 });

  // Rounded up to the nearest five minutes. The exact figure is 17,5, and
  // "environ 18 min" claims a precision that four averaged numbers do not
  // have. "Moins de 20 minutes" is true and is what the reader retains.
  const minutesPerDay =
    Math.ceil(
      (PREVIOUS_EDITION.hours * 60) / PREVIOUS_EDITION.participants / 30 / 5,
    ) * 5;

  return (
    <section aria-labelledby="chiffres" className="space-y-8">
      <div>
        <h2 id="chiffres" className="text-ink text-2xl font-bold sm:text-3xl">
          Ce que ça a déjà donné
        </h2>
        <p className="text-ink-muted mt-2">
          L’édition {PREVIOUS_EDITION.year}, portée par l’association sans
          application : {number(PREVIOUS_EDITION.participants)} participants.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Figure
          value={`${number(PREVIOUS_EDITION.amountEuros)} €`}
          label="collectés"
          detail={`soit ${perParticipant} € par participant`}
        />
        <Figure
          value={`${number(PREVIOUS_EDITION.kilometres)} km`}
          label="parcourus"
        />
        <Figure
          value={`${number(PREVIOUS_EDITION.hours)} h`}
          label="de sport"
          detail={`moins de ${minutesPerDay} min par jour et par personne`}
        />
      </div>

      <div className="border-line bg-surface-sunken rounded-xl border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-ink font-semibold">
            L’édition {EDITION_YEAR} en cours
          </h3>
          {/* The badge changes with the figures rather than being removed.
              A counter at zero without a label reads as a failing counter,
              and "aucun participant inscrit" is a true and useful thing to
              say in September. */}
          <Badge tone={live?.available ? "success" : "neutral"}>
            {live?.available ? "En direct" : "Compteur en préparation"}
          </Badge>
        </div>

        {live?.available ? (
          <>
            <div className="mt-4 grid gap-6 sm:grid-cols-3">
              <Figure
                value={`${number(Math.round(live.collectedCents / 100))} €`}
                label="collectés"
                detail={`${number(live.participants)} participant${live.participants > 1 ? "s" : ""} inscrit${live.participants > 1 ? "s" : ""}`}
              />
              <Figure
                value={`${number(live.kilometres)} km`}
                label="parcourus"
              />
              <Figure value={`${number(live.hours)} h`} label="de sport" />
            </div>

            <p className="text-ink-muted mt-4 text-sm">
              Objectif : {number(COLLECTIVE_GOALS.participants)} participants,{" "}
              {number(COLLECTIVE_GOALS.amountEuros)} € reversés et{" "}
              {number(COLLECTIVE_GOALS.kilometres)} km parcourus.
            </p>
          </>
        ) : (
          <p className="text-ink-muted mt-2">
            {number(COLLECTIVE_GOALS.participants)} participants,{" "}
            {number(COLLECTIVE_GOALS.amountEuros)} € reversés et{" "}
            {number(COLLECTIVE_GOALS.kilometres)} km parcourus. Le compteur en
            temps réel s’affichera ici à l’ouverture des inscriptions.
          </p>
        )}
      </div>
    </section>
  );
}
