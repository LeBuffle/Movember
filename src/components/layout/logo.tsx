import { cn } from "@/lib/cn";

/**
 * The project's logo, in the two sizes the application shows it.
 *
 * **It is the project's own identity, and that is a legal requirement rather
 * than a preference** (`CLAUDE.md` §5): no Movember Foundation logo, no
 * Foundation imagery, and nothing that could let a visitor believe this is the
 * Foundation's official application. The mark carries the moustache and the
 * two colours of the charter — blue and orange — and belongs to the
 * association.
 *
 * A plain `<img>` rather than `next/image`. The project builds standalone on a
 * small VPS and does not carry `sharp` at runtime, which the image optimiser
 * needs; a static PNG served as-is has nothing to optimise anyway. The
 * dimensions are written out so the browser reserves the space before the file
 * arrives — without them the header jumps once the logo lands, on every cold
 * load, which is exactly when somebody is deciding whether to trust the site.
 */

type Size = "header" | "large";

const SOURCES: Record<Size, { src: string; width: number; height: number }> = {
  /** 44 px tall on screen, served at three times that for dense screens. */
  header: { src: "/brand/logo-en-tete.png", width: 122, height: 132 },
  /** Sign-in, sign-up, and anywhere the logo is the main object. */
  large: { src: "/brand/logo-web.png", width: 371, height: 400 },
};

const CLASSES: Record<Size, string> = {
  header: "h-11 w-auto",
  large: "h-32 w-auto sm:h-40",
};

export function Logo({
  size = "header",
  className,
}: {
  size?: Size;
  className?: string;
}) {
  const source = SOURCES[size];

  return (
    <img
      src={source.src}
      width={source.width}
      height={source.height}
      /* The alt text names the project, not the picture. A screen reader
         announcing "logo" tells its listener nothing they can act on. */
      alt="DEFI Movember"
      className={cn(CLASSES[size], className)}
    />
  );
}
