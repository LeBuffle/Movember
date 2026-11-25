import { cn } from "@/lib/cn";

/**
 * Loading indicator.
 *
 * Always ships a visually hidden label: a spinning circle alone tells a
 * screen-reader user nothing.
 */
export function Spinner({
  label = "Chargement en cours",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="text-brand-blue size-5 animate-spin"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
