import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { TimelinePoint } from "@/lib/types";
import { money, netClass, cn } from "@/lib/utils";

/**
 * Chart colors are read from CSS variables so they follow the theme
 * (values come from the validated dataviz palette in index.css).
 */
function useChartColors() {
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement);
    const v = (name: string) => s.getPropertyValue(name).trim();
    return {
      line: v("--chart-line"),
      grid: v("--chart-grid"),
      axis: v("--chart-axis"),
      muted: v("--chart-muted"),
      win: v("--chart-win"),
      loss: v("--chart-loss"),
    };
  }, [document.documentElement.classList.contains("dark")]);
}

export type Range = "30d" | "90d" | "1y" | "all";

export function filterRange(points: TimelinePoint[], range: Range) {
  if (range === "all") return points;
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const cutoff = Date.now() - days * 86_400_000;
  const kept = points.filter((p) => new Date(p.date).getTime() >= cutoff);
  // Re-base the cumulative line at the start of the window.
  let cum = 0;
  return kept.map((p) => {
    cum += p.net ?? 0;
    return { ...p, cumulative: Math.round(cum * 100) / 100 };
  });
}

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: Array<{ payload: TimelinePoint }>; currency: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{format(new Date(p.date), "d MMM yyyy")}</div>
      <div className="text-muted-foreground">{p.label}{p.groupName ? ` · ${p.groupName}` : ""}</div>
      <div className="mt-1 flex justify-between gap-4">
        <span className="text-muted-foreground">Session</span>
        <span className={cn("tabular font-medium", netClass(p.net))}>{money(p.net, currency, { sign: true })}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Running total</span>
        <span className={cn("tabular font-medium", netClass(p.cumulative))}>{money(p.cumulative, currency, { sign: true })}</span>
      </div>
    </div>
  );
}

/** Cumulative profit over time — single series, so no legend. */
export function CumulativeChart({ points, currency = "€", height = 240 }: { points: TimelinePoint[]; currency?: string; height?: number }) {
  const c = useChartColors();
  if (points.length === 0) return <EmptyChart height={height} />;
  const data = points.map((p) => ({ ...p, t: new Date(p.date).getTime() }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.line} stopOpacity={0.25} />
              <stop offset="100%" stopColor={c.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(t) => format(new Date(t), data.length > 1 && data[data.length - 1].t - data[0].t > 300 * 86_400_000 ? "MMM yy" : "d MMM")}
            tick={{ fill: c.muted, fontSize: 11 }}
            axisLine={{ stroke: c.axis }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v) => money(v, currency)}
            tick={{ fill: c.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <ReferenceLine y={0} stroke={c.axis} />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={c.line}
            strokeWidth={2}
            fill="url(#cumFill)"
            dot={data.length <= 40 ? { r: 3, fill: c.line, strokeWidth: 0 } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-surface)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Per-session net as bars: win/loss is a polarity, so colour carries sign and the number carries the value. */
export function SessionBars({ points, currency = "€", height = 200 }: { points: TimelinePoint[]; currency?: string; height?: number }) {
  const c = useChartColors();
  if (points.length === 0) return <EmptyChart height={height} />;
  const data = points.slice(-30).map((p) => ({ ...p, name: format(new Date(p.date), "d MMM") }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: c.muted, fontSize: 11 }} axisLine={{ stroke: c.axis }} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => money(v, currency)} tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
          <ReferenceLine y={0} stroke={c.axis} />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
          <Bar dataKey="net" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.id} fill={(p.net ?? 0) >= 0 ? c.win : c.loss} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      No submitted results yet
    </div>
  );
}
