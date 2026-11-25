import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "blue" | "orange" | "success" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-muted border-line",
  blue: "bg-brand-blue-soft text-brand-blue border-brand-blue",
  orange: "bg-brand-orange-soft text-brand-orange-ink border-brand-orange",
  success: "bg-success-soft text-success border-success",
  danger: "bg-danger-soft text-danger border-danger",
};

/**
 * Small status label. Card rarities reuse this in epic 5, which is why the
 * tones are named by colour rather than by meaning.
 */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5",
        "text-sm font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
