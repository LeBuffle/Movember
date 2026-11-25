import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Highlights the card with the accent colour, e.g. the challenge of the day. */
  accent?: boolean;
};

export function Card({ accent, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-xl border p-5",
        accent ? "border-brand-orange border-l-4" : "border-line",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-ink text-lg font-semibold">{children}</h3>;
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="text-ink-muted mt-2">{children}</div>;
}
