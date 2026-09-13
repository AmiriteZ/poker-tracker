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

export const ROLE_LABEL: Record<"ADMIN" | "ORGANISER" | "MEMBER", string> = {
  ADMIN: "Admin",
  ORGANISER: "Organiser",
  MEMBER: "Member",
};

export const ROLE_HELP: Record<"ADMIN" | "ORGANISER" | "MEMBER", string> = {
  ADMIN: "Approves members, manages roles and every game day, can edit any result.",
  ORGANISER: "Can create game days and manage the ones they created. Can't approve members or edit others' results.",
  MEMBER: "Can view everything and submit their own results.",
};
