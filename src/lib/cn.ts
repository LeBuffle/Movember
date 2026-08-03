import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, letting later Tailwind utilities win over earlier ones.
 * Lets callers override a component's default styling without specificity
 * fights.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
