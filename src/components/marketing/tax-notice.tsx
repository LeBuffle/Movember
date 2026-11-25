import { TAX_NOTICE, TAX_NOTICE_TITLE } from "@/lib/legal/notices";
import { cn } from "@/lib/cn";

/**
 * The tax notice, drawn to be read.
 *
 * Deliberately not an `Alert` in a warning tone. This is not a warning about
 * something going wrong — it is a plain statement of what the participant is
 * buying, and dressing it as an error would make it look like a problem
 * rather than a fact. It is bordered and set on the accent tint so that it
 * cannot be scrolled past, which is the whole of AC 3.
 *
 * It appears on the home page next to the prices, and epic 2 repeats it
 * immediately before payment. Repeating it is intentional: a single mention,
 * however visible, is not what "clearly and unambiguously" means when money
 * is involved.
 */
export function TaxNotice({ className }: { className?: string }) {
  return (
    <aside
      aria-labelledby="mention-fiscale"
      className={cn(
        "border-brand-orange bg-brand-orange-soft rounded-xl border-2 p-5",
        className,
      )}
    >
      <h2
        id="mention-fiscale"
        className="text-brand-orange-ink text-lg font-bold"
      >
        {TAX_NOTICE_TITLE}
      </h2>
      <p className="text-ink mt-2">{TAX_NOTICE}</p>
    </aside>
  );
}
