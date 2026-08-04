import { Badge } from "@/components/ui/badge";
import {
  COLLECTIVE_GOALS,
  EDITION_YEAR,
  PREVIOUS_EDITION,
} from "@/lib/edition/calendar";

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
export function CollectiveFigures() {
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
            L’objectif de l’édition {EDITION_YEAR}
          </h3>
          {/* Says plainly that nothing is being counted yet. A counter at
              zero without this label reads as a failing counter. */}
          <Badge tone="neutral">Compteur en préparation</Badge>
        </div>
        <p className="text-ink-muted mt-2">
          {number(COLLECTIVE_GOALS.participants)} participants,{" "}
          {number(COLLECTIVE_GOALS.amountEuros)} € reversés et{" "}
          {number(COLLECTIVE_GOALS.kilometres)} km parcourus. Le compteur en
          temps réel s’affichera ici à l’ouverture des inscriptions.
        </p>
      </div>
    </section>
  );
}
