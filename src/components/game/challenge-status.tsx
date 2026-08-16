import { cn } from "@/lib/cn";
import {
  CHALLENGE_STATUS_LABELS,
  type ChallengeStatusValue,
} from "@/lib/challenges/status";

export type { ChallengeStatusValue };

/**
 * Visual state of a challenge.
 *
 * Deliberately built as one component rather than as ad-hoc styling on each
 * screen, because it enforces a rule the whole app depends on: **a state is
 * never conveyed by colour alone**. Each state carries a shape (icon) and a
 * word (label) as well.
 *
 * Around 8% of men have some form of colour vision deficiency, and red/green
 * is the common one — on a men's health fundraiser aimed at a mostly male
 * audience, "green means done, red means missed" would fail a real share of
 * participants.
 */
const states: Record<
  ChallengeStatusValue,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  open: {
    label: CHALLENGE_STATUS_LABELS.open,
    classes: "bg-surface-sunken text-ink-muted border-line",
    icon: (
      <path
        d="M12 6v6l4 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  succeeded: {
    label: CHALLENGE_STATUS_LABELS.succeeded,
    classes: "bg-success-soft text-success border-success",
    icon: (
      <path
        d="m7 12.5 3.5 3.5L17 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  failed: {
    label: CHALLENGE_STATUS_LABELS.failed,
    classes: "bg-danger-soft text-danger border-danger",
    icon: (
      <path
        d="m8 8 8 8M16 8l-8 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    ),
  },
};

export function ChallengeStatus({
  status,
  className,
}: {
  status: ChallengeStatusValue;
  className?: string;
}) {
  const state = states[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        "text-sm font-semibold",
        state.classes,
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="size-4"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.3" />
        {state.icon}
      </svg>
      {state.label}
    </span>
  );
}
