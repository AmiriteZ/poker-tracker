import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ClipboardList, Crown } from "lucide-react";
import { api } from "@/lib/api";
import type { GroupDetail, PlayerStats } from "@/lib/types";
import { cn, money, netClass } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsPanel } from "@/components/stats";
import { Reveal, staggerDelay } from "@/components/ui/reveal";

/** A player's profile inside one group. */
export function PlayerPage() {
  const { groupId = "", userId = "" } = useParams();
  const group = useQuery({ queryKey: ["group", groupId], queryFn: () => api.get<GroupDetail>(`/groups/${groupId}`) });
  const stats = useQuery({ queryKey: ["player-stats", groupId, userId], queryFn: () => api.get<PlayerStats>(`/groups/${groupId}/players/${userId}/stats`) });

  if (group.isLoading || stats.isLoading) return <Skeleton className="h-96" />;
  if (!group.data || !stats.data) return <div className="text-muted-foreground">Player not found.</div>;
  const g = group.data;
  const p = stats.data;
  const recent = [...p.timeline].reverse().slice(0, 10);

  return (
    <div>
      <Link to={`/groups/${groupId}?tab=players`} className="text-xs text-muted-foreground hover:text-foreground">
        ← {g.name}
      </Link>
      <div className="mb-6 mt-1 flex items-center gap-4">
        <UserAvatar name={p.user.displayName} src={p.user.avatarUrl} className="size-16" textClassName="text-xl" />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {p.user.displayName}
            {p.role === "ADMIN" ? <Crown className="size-5 text-primary" /> : p.role === "ORGANISER" ? <ClipboardList className="size-5 text-muted-foreground" /> : null}
          </h1>
          <p className="text-sm text-muted-foreground">Results in {g.name}</p>
        </div>
      </div>

      <StatsPanel block={{ summary: p.summary, timeline: p.timeline }} currency={g.currency} />

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">No submitted results yet.</div>
          ) : (
            <div className="divide-y">
              {recent.map((t, i) => (
                <Reveal key={t.id} delay={staggerDelay(i, 35, 250)}>
                  <Link to={`/groups/${groupId}/sessions/${t.sessionId}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-accent/50">
                    <div className="w-24 shrink-0 text-muted-foreground">{format(new Date(t.date), "d MMM yyyy")}</div>
                    <div className="min-w-0 flex-1 truncate">{t.label}</div>
                    <div className="hidden tabular text-xs text-muted-foreground sm:block">
                      {money(t.buyIn, g.currency)} → {money(t.cashOut, g.currency)}
                    </div>
                    <div className={cn("tabular font-semibold", netClass(t.net))}>{money(t.net, g.currency, { sign: true })}</div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
