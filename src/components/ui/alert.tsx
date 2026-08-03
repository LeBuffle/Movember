import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<AlertTone, string> = {
  info: "bg-brand-blue-soft border-brand-blue text-ink",
  success: "bg-success-soft border-success text-ink",
  warning: "bg-brand-orange-soft border-brand-orange text-ink",
  danger: "bg-danger-soft border-danger text-ink",
};

/** Prefix carrying the meaning in words, so it never rests on colour alone. */
const toneLabels: Record<AlertTone, string> = {
  info: "Information",
  success: "Succès",
  warning: "Attention",
  danger: "Erreur",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      // `alert` is reserved for errors that need immediate announcement;
      // anything else is announced politely so it does not interrupt.
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-lg border-l-4 p-4", toneClasses[tone], className)}
    >
      <p className="font-semibold">{title ?? toneLabels[tone]}</p>
      <div className="text-ink-muted mt-1">{children}</div>
    </div>
  );
}
