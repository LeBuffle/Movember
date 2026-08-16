import { logoInitials } from "@/lib/super-teams/logo";
import { cn } from "@/lib/cn";

/**
 * A team's or a federation's badge (story 14.4).
 *
 * **Never a broken image, and never an empty square.** Most teams will never
 * upload anything, and a ranking page full of grey holes reads as a fault in
 * the application rather than as a choice nobody made. So the fallback is a
 * deliberate pill with the team's initials in it.
 *
 * A plain `<img>`, like every other picture in this project: `next/image`
 * would pull `sharp` into the runtime container for a badge that is already
 * the right size.
 *
 * The file is shown **as it comes**, fitted inside a square. No cropping and
 * no retouching: an image editor in the browser is a project of its own, and
 * it only ever repairs a file the captain can crop themselves in thirty
 * seconds.
 */
export function TeamLogo({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const box = {
    sm: "size-8 text-xs",
    md: "size-12 text-sm",
    lg: "size-24 text-xl",
  }[size];

  if (!url) {
    return (
      <span
        aria-hidden
        className={cn(
          "bg-brand-blue-soft text-brand-blue flex shrink-0 items-center justify-center rounded-lg font-bold",
          box,
        )}
      >
        {logoInitials(name)}
      </span>
    );
  }

  return (
    <img
      src={url}
      // The team is what the reader needs named, not the file.
      alt={`Logo de ${name}`}
      className={cn(
        "border-line shrink-0 rounded-lg border bg-white object-contain",
        box,
      )}
      loading="lazy"
    />
  );
}
