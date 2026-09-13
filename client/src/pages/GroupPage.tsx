import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Coins,
  Copy,
  Crown,
  MapPin,
  Plus,
  RefreshCw,
  Trophy,
  UserMinus,
  X,
  Link2,
  Settings2,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { GroupDetail, LeaderboardRow, Member, Role, Session } from "@/lib/types";
import { cn, money, netClass, ROLE_HELP, ROLE_LABEL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/layout";

export function GroupPage() {
  const { groupId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "sessions";
  const group = useQuery({ queryKey: ["group", groupId], queryFn: () => api.get<GroupDetail>(`/groups/${groupId}`) });

  if (group.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (group.error || !group.data) {
    return <EmptyState icon={AlertTriangle} title="Can't open this group" body={group.error instanceof ApiError ? group.error.message : "Something went wrong."} />;
  }
  const g = group.data;
  const isAdmin = g.myRole === "ADMIN";
  const canCreate = isAdmin || g.myRole === "ORGANISER";

  return (
    <div>
      <PageHeader
        back="/"
        title={g.name}
        subtitle={
          <>
            {g.description ? <>{g.description} · </> : null}
            {g.members.length} member{g.members.length === 1 ? "" : "s"}
          </>
        }
        actions={canCreate ? <NewSessionDialog group={g} /> : null}
      />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="sessions">
            <CalendarDays className="size-4" /> Game days
          </TabsTrigger>
          <TabsTrigger value="players">
            <Trophy className="size-4" /> Players
          </TabsTrigger>
          {isAdmin ? (
            <TabsTrigger value="manage">
              <Settings2 className="size-4" /> Manage
              {g.pending.length ? <Badge className="ml-1 px-1.5 py-0">{g.pending.length}</Badge> : null}
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="sessions">
          <SessionsTab group={g} />
        </TabsContent>
        <TabsContent value="players">
          <PlayersTab group={g} />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="manage">
            <ManageTab group={g} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

/* ---------------- Sessions ---------------- */

function SessionsTab({ group }: { group: GroupDetail }) {
  const sessions = useQuery({ queryKey: ["sessions", group.id], queryFn: () => api.get<Session[]>(`/groups/${group.id}/sessions`) });
  const { profile } = useAuth();

  if (sessions.isLoading) return <Skeleton className="h-48" />;
  const list = sessions.data ?? [];
  const canCreate = group.myRole === "ADMIN" || group.myRole === "ORGANISER";
  if (list.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No game days yet"
        body={canCreate ? "Create the first session and seat the players who showed up." : "An admin or organiser will add sessions when you play."}
        action={canCreate ? <NewSessionDialog group={group} /> : undefined}
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((s) => {
        const mine = s.results.find((r) => r.user.id === profile?.id);
        return (
          <Link key={s.id} to={`/groups/${group.id}/sessions/${s.id}`} className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.title ?? format(new Date(s.playedAt), "EEEE d MMMM")}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{format(new Date(s.playedAt), "d MMM yyyy")}</span>
                  {s.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {s.location}
                    </span>
                  ) : null}
                  <span>{s.playerCount} players</span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground tabular">
                    <Coins className="size-3" /> Pot {money(s.pot, group.currency)}
                  </span>
                </div>
              </div>
              {mine ? (
                mine.submitted ? (
                  <Badge variant={(mine.net ?? 0) >= 0 ? "win" : "loss"} className="tabular shrink-0">
                    {money(mine.net, group.currency, { sign: true })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">
                    Enter result
                  </Badge>
                )
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <ResultChip label="Top winner" row={s.topWinner} currency={group.currency} />
              <ResultChip label="Biggest loser" row={s.topLoser} currency={group.currency} />
            </div>

            {s.submittedCount < s.playerCount ? (
              <div className="mt-3 text-xs text-muted-foreground">
                {s.submittedCount}/{s.playerCount} results in
              </div>
            ) : s.discrepancy ? (
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-loss">
                <AlertTriangle className="size-3" /> Table is off by {money(s.discrepancy, group.currency, { sign: true })}
              </div>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function ResultChip({ label, row, currency }: { label: string; row: Session["topWinner"]; currency: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {row ? (
        <div className="mt-1 flex items-center gap-2">
          <UserAvatar name={row.user.displayName} src={row.user.avatarUrl} className="size-6" textClassName="text-[10px]" />
          <span className="truncate text-sm">{row.user.displayName}</span>
          <span className={cn("ml-auto tabular text-sm font-semibold", netClass(row.net))}>{money(row.net, currency, { sign: true })}</span>
        </div>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">—</div>
      )}
    </div>
  );
}

export function NewSessionDialog({ group }: { group: GroupDetail }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [playedAt, setPlayedAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [players, setPlayers] = useState<Set<string>>(() => new Set(group.members.map((m) => m.user.id)));

  const toggle = (id: string) =>
    setPlayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const create = useMutation({
    mutationFn: () =>
      api.post<Session>(`/groups/${group.id}/sessions`, {
        title: title || null,
        location: location || null,
        notes: notes || null,
        playedAt: new Date(playedAt).toISOString(),
        playerIds: [...players],
      }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["sessions", group.id] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Session created");
      setOpen(false);
      navigate(`/groups/${group.id}/sessions/${s.id}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not create session"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New game day
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>New game day</DialogTitle>
            <DialogDescription>Seat the players who are in. They'll enter their own buy-in and cash-out.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="stitle">Title (optional)</Label>
              <Input id="stitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday cash game" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sdate">Date & time</Label>
              <Input id="sdate" type="datetime-local" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sloc">Location</Label>
              <Input id="sloc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Dave's place" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="snotes">Notes (optional)</Label>
              <Textarea id="snotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Blinds, house rules, who brought the pizza…" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Players ({players.size})</Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setPlayers(new Set(group.members.map((m) => m.user.id)))}>
                  All
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setPlayers(new Set())}>
                  None
                </button>
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
              {group.members.map((m) => {
                const on = players.has(m.user.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => toggle(m.user.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                      on ? "border-primary bg-primary/10" : "hover:bg-accent"
                    )}
                  >
                    <UserAvatar name={m.user.displayName} src={m.user.avatarUrl} className="size-7" textClassName="text-xs" />
                    <span className="truncate">{m.user.displayName}</span>
                    {on ? <Check className="ml-auto size-4 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={create.isPending}>
              Create session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Players / leaderboard ---------------- */

function PlayersTab({ group }: { group: GroupDetail }) {
  const board = useQuery({ queryKey: ["leaderboard", group.id], queryFn: () => api.get<LeaderboardRow[]>(`/groups/${group.id}/leaderboard`) });
  if (board.isLoading) return <Skeleton className="h-64" />;
  const rows = board.data ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Leaderboard</CardTitle>
        <CardDescription>All-time results in this group. Tap a player to see their history.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.map((r, i) => (
            <Link key={r.user.id} to={`/groups/${group.id}/players/${r.user.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50">
              <div className={cn("w-6 text-center text-sm font-semibold tabular", i === 0 && r.summary.net > 0 ? "text-[#eda100]" : "text-muted-foreground")}>{i + 1}</div>
              <UserAvatar name={r.user.displayName} src={r.user.avatarUrl} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  {r.user.displayName}
                  <RoleIcon role={r.role} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.summary.submitted} session{r.summary.submitted === 1 ? "" : "s"} · {r.summary.wins}W {r.summary.losses}L
                </div>
              </div>
              <div className={cn("tabular text-right font-semibold", netClass(r.summary.net))}>{money(r.summary.net, group.currency, { sign: true })}</div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Admin: manage ---------------- */

function ManageTab({ group }: { group: GroupDetail }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["group", group.id] });
    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["leaderboard", group.id] });
  };
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Something went wrong");

  const approve = useMutation({ mutationFn: (id: string) => api.post(`/groups/${group.id}/members/${id}/approve`), onSuccess: () => { refresh(); toast.success("Member approved"); }, onError: onErr });
  const reject = useMutation({ mutationFn: (id: string) => api.post(`/groups/${group.id}/members/${id}/reject`), onSuccess: refresh, onError: onErr });
  const setRole = useMutation({ mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch(`/groups/${group.id}/members/${id}`, { role }), onSuccess: () => { refresh(); toast.success("Role updated"); }, onError: onErr });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/groups/${group.id}/members/${id}`), onSuccess: refresh, onError: onErr });
  const regen = useMutation({ mutationFn: () => api.post<{ code: string }>(`/groups/${group.id}/regenerate-code`), onSuccess: () => { refresh(); toast.success("New code generated"); }, onError: onErr });
  const leave = useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${group.id}/members/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); navigate("/"); },
    onError: onErr,
  });

  const link = `${window.location.origin}/join/${group.code}`;
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };
  const myMembership = group.members.find((m) => m.user.id === profile?.id);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invite friends</CardTitle>
          <CardDescription>Send the link or the code. You'll confirm each person before they get in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-lg tracking-[0.3em]">{group.code}</div>
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => copy(group.code ?? "", "Code")} aria-label="Copy code">
              <Copy />
            </Button>
          </div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{link}</div>
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => copy(link, "Link")} aria-label="Copy link">
              <Link2 />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => regen.mutate()} loading={regen.isPending}>
            <RefreshCw /> Generate a new code
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Join requests {group.pending.length ? `(${group.pending.length})` : ""}</CardTitle>
          <CardDescription>People who used your code and are waiting for a yes.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {group.pending.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">No pending requests.</div>
          ) : (
            <div className="divide-y">
              {group.pending.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5">
                  <UserAvatar name={m.user.displayName} src={m.user.avatarUrl} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.user.displayName}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.user.email}</div>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={() => approve.mutate(m.id)} loading={approve.isPending}>
                    <Check /> <span className="hidden sm:inline">Approve</span>
                  </Button>
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => reject.mutate(m.id)} aria-label="Reject">
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members & roles</CardTitle>
          <CardDescription>
            <span className="block"><span className="font-medium text-foreground">Admin</span> — {ROLE_HELP.ADMIN}</span>
            <span className="block"><span className="font-medium text-foreground">Organiser</span> — {ROLE_HELP.ORGANISER}</span>
            <span className="block"><span className="font-medium text-foreground">Member</span> — {ROLE_HELP.MEMBER}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {group.members.map((m: Member) => {
              const isMe = m.user.id === profile?.id;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                  <UserAvatar name={m.user.displayName} src={m.user.avatarUrl} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-medium">
                      {m.user.displayName} {isMe ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">Joined {format(new Date(m.createdAt), "d MMM yyyy")}</div>
                  </div>
                  {isMe ? (
                    <Badge variant="default">{ROLE_LABEL[m.role]}</Badge>
                  ) : (
                    <div className="flex w-full items-center gap-1 sm:w-auto">
                      <Select value={m.role} onValueChange={(role) => setRole.mutate({ id: m.id, role: role as Role })}>
                        <SelectTrigger className="h-8 w-full sm:w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="ORGANISER">Organiser</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (confirm(`Remove ${m.user.displayName} from the group?`)) remove.mutate(m.id); }} aria-label="Remove">
                        <UserMinus />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {myMembership ? (
        <div className="lg:col-span-2 flex justify-end">
          <Button variant="ghost" className="text-loss" onClick={() => leave.mutate(myMembership.id)} loading={leave.isPending}>
            <LogOut /> Leave group
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RoleIcon({ role }: { role: Role }) {
  if (role === "ADMIN") return <Crown className="size-3.5 shrink-0 text-muted-foreground" aria-label="Admin" />;
  if (role === "ORGANISER") return <ClipboardList className="size-3.5 shrink-0 text-muted-foreground" aria-label="Organiser" />;
  return null;
}
