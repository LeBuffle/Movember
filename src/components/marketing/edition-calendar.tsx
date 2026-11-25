import { EDITION_MILESTONES, EDITION_YEAR } from "@/lib/edition/calendar";

/**
 * The three dates that matter.
 *
 * Kept on the public page because the most common question about a
 * time-boxed event is "is it too late?". Someone arriving on 12 November has
 * to be able to answer that without writing to anyone.
 *
 * `<time dateTime>` carries the machine-readable date next to the French
 * label, so the ordinal in "1ᵉʳ novembre" stays readable without making the
 * date ambiguous.
 */
export function EditionCalendar() {
  return (
    <section aria-labelledby="calendrier">
      <h2 id="calendrier" className="text-ink text-2xl font-bold sm:text-3xl">
        Le calendrier de l’édition {EDITION_YEAR}
      </h2>

      <ol className="border-line divide-line mt-6 divide-y border-y">
        {EDITION_MILESTONES.map((milestone) => (
          <li
            key={milestone.date}
            className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-x-4"
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
      </ol>
    </section>
  );
}
