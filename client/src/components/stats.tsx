import { useState } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { StatsBlock, Summary } from "@/lib/types";
import { cn, money, netClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CumulativeChart, SessionBars, filterRange, type Range } from "@/components/charts";
import { Reveal, staggerDelay } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";

export function StatTiles({ summary, currency = "€", compact = false, allTimeNet }: { summary: Summary; currency?: string; compact?: boolean; allTimeNet?: number }) {
  const Icon = summary.net > 0 ? TrendingUp : summary.net < 0 ? TrendingDown : Minus;
  const winRate = summary.submitted ? Math.round((summary.wins / summary.submitted) * 100) : 0;
  const tiles: { label: string; value: number | string; cls?: string; icon?: React.ReactNode; sub?: string; mobileOnly?: boolean; countUp?: boolean }[] = [
    {
      label: "Net profit",
      value: summary.net,
      cls: netClass(summary.net),
      icon: <Icon className={cn("size-4", netClass(summary.net))} />,
      countUp: true,
    },
    { label: "Sessions", value: String(summary.submitted), sub: summary.games > summary.submitted ? `${summary.games - summary.submitted} pending` : undefined },
    { label: "Win rate", value: `${winRate}%`, sub: `${summary.wins}W · ${summary.losses}L` },
    { label: "Avg / session", value: money(summary.avgNet, currency, { sign: true }), cls: netClass(summary.avgNet) },
    { label: "Best night", value: money(summary.biggestWin, currency, { sign: true }), cls: netClass(summary.biggestWin) },
    { label: "Worst night", value: money(summary.biggestLoss, currency, { sign: true }), cls: netClass(summary.biggestLoss) },
  ];
  // On phones the profile header hides its all-time tile; show it here beside "Worst night" instead.
  if (allTimeNet != null) {
    tiles.push({ label: "All-time net", value: allTimeNet, cls: netClass(allTimeNet), mobileOnly: true, countUp: true });
  }
  const shown = compact ? tiles.slice(0, 4) : tiles;
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6")}>
      {shown.map((t, i) => (
        <Reveal
          key={t.label}
          delay={staggerDelay(i, 50, 250)}
          className={cn("rounded-xl border bg-card p-4 shadow-card", t.mobileOnly && "col-span-2 md:hidden")}
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            {t.label}
            {t.icon}
          </div>
          <div className={cn("mt-1 text-2xl font-bold tracking-tight tabular", t.cls)}>
            {t.countUp ? <CountUp value={t.value as number} format={(n) => money(n, currency, { sign: true })} /> : t.value}
          </div>
          {t.sub ? <div className="mt-0.5 text-xs text-muted-foreground">{t.sub}</div> : null}
        </Reveal>
      ))}
    </div>
  );
}

const RANGES: { key: Range; label: string }[] = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "1y", label: "1y" },
  { key: "all", label: "All" },
];

export function StatsPanel({ block, currency = "€", title = "Profit over time", allTimeNet }: { block: StatsBlock; currency?: string; title?: string; allTimeNet?: number }) {
  const [range, setRange] = useState<Range>("all");
  const points = filterRange(block.timeline, range);
  return (
    <div className="space-y-4">
      <StatTiles summary={block.summary} currency={currency} allTimeNet={allTimeNet} />
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>Running total after each session</CardDescription>
          </div>
          <div className="inline-flex shrink-0 rounded-md border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors active:scale-95",
                  range === r.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <CumulativeChart points={points} currency={currency} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Session results</CardTitle>
          <CardDescription>Last {Math.min(30, points.length)} sessions in this range</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionBars points={points} currency={currency} />
        </CardContent>
      </Card>
    </div>
  );
}
