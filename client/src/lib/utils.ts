import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(n: number | null | undefined, currency = "€", opts: { sign?: boolean } = {}) {
  if (n == null) return "—";
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const sign = n < 0 ? "-" : opts.sign && n > 0 ? "+" : "";
  return `${sign}${currency}${abs}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function netClass(n: number | null | undefined) {
  if (n == null) return "text-muted-foreground";
  if (n > 0) return "text-win";
  if (n < 0) return "text-loss";
  return "text-muted-foreground";
}
