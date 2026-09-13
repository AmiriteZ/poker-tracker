import { Prisma } from "../generated/prisma/client.js";

export const dec = (d: Prisma.Decimal | number | null | undefined) =>
  d == null ? null : Number(d);

/**
 * Turns a SessionResult row into the numbers players actually care about.
 * Bank figures + chip purchases between players:
 *   effective buy-in  = buyIn + chipsBought
 *   effective cash-out = cashOut + chipsSold   (null until the player submits)
 */
export function effective(r: { buyIn: unknown; cashOut: unknown; chipsBought: unknown; chipsSold: unknown }) {
  const bankBuyIn = dec(r.buyIn as never) ?? 0;
  const bankCashOut = dec(r.cashOut as never);
  const chipsBought = dec(r.chipsBought as never) ?? 0;
  const chipsSold = dec(r.chipsSold as never) ?? 0;
  const buyIn = round(bankBuyIn + chipsBought);
  const cashOut = bankCashOut == null ? null : round(bankCashOut + chipsSold);
  return {
    bankBuyIn,
    bankCashOut,
    chipsBought,
    chipsSold,
    buyIn,
    cashOut,
    net: cashOut == null ? null : round(cashOut - buyIn),
    submitted: bankCashOut != null,
  };
}

export interface ResultPoint {
  id: string;
  date: string; // ISO
  label: string; // session title / location / solo label
  groupId: string | null;
  groupName: string | null;
  sessionId: string | null;
  buyIn: number;
  cashOut: number | null;
  net: number | null; // null when the player hasn't submitted a cash-out
}

export interface Summary {
  games: number;
  submitted: number;
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
  wins: number;
  losses: number;
  breakEven: number;
  biggestWin: number;
  biggestLoss: number;
  avgNet: number;
}

export function summarize(points: ResultPoint[]): Summary {
  const submitted = points.filter((p) => p.net != null);
  const nets = submitted.map((p) => p.net as number);
  const totalBuyIn = submitted.reduce((s, p) => s + p.buyIn, 0);
  const totalCashOut = submitted.reduce((s, p) => s + (p.cashOut ?? 0), 0);
  const net = totalCashOut - totalBuyIn;
  return {
    games: points.length,
    submitted: submitted.length,
    totalBuyIn: round(totalBuyIn),
    totalCashOut: round(totalCashOut),
    net: round(net),
    wins: nets.filter((n) => n > 0).length,
    losses: nets.filter((n) => n < 0).length,
    breakEven: nets.filter((n) => n === 0).length,
    biggestWin: round(nets.length ? Math.max(0, ...nets) : 0),
    biggestLoss: round(nets.length ? Math.min(0, ...nets) : 0),
    avgNet: round(nets.length ? net / nets.length : 0),
  };
}

/** Sorted ascending by date with a running cumulative net for charting. */
export function timeline(points: ResultPoint[]) {
  const sorted = [...points]
    .filter((p) => p.net != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  return sorted.map((p) => {
    cumulative += p.net as number;
    return { ...p, cumulative: round(cumulative) };
  });
}

export const round = (n: number) => Math.round(n * 100) / 100;
