import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, MapPin, Pencil, Plus, Trash2, UserMinus, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { GroupDetail, Session, SessionResultRow } from "@/lib/types";
import { cn, money, netClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout";

export function SessionPage() {
  const { groupId = "", sessionId = "" } = useParams();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const group = useQuery({ queryKey: ["group", groupId], queryFn: () => api.get<GroupDetail>(`/groups/${groupId}`) });
  const session = useQuery({ queryKey: ["session", groupId, sessionId], queryFn: () => api.get<Session>(`/groups/${groupId}/sessions/${sessionId}`) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["session", groupId, sessionId] });
    qc.invalidateQueries({ queryKey: ["sessions", groupId] });
    qc.invalidateQueries({ queryKey: ["leaderboard", groupId] });
    qc.invalidateQueries({ queryKey: ["my-stats"] });
  };
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Something went wrong");

  const removePlayer = useMutation({ mutationFn: (userId: string) => api.delete(`/groups/${groupId}/sessions/${sessionId}/players/${userId}`), onSuccess: refresh, onError: onErr });
  const addPlayer = useMutation({ mutationFn: (userId: string) => api.post(`/groups/${groupId}/sessions/${sessionId}/players`, { userId }), onSuccess: refresh, onError: onErr });
  const del = useMutation({
    mutationFn: () => api.delete(`/groups/${groupId}/sessions/${sessionId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions", groupId] }); navigate(`/groups/${groupId}`); },
    onError: onErr,
  });

  if (group.isLoading || session.isLoading) return <Skeleton className="h-96" />;
  if (!group.data || !session.data) return <div className="text-muted-foreground">Session not found.</div>;

  const g = group.data;
  const s = session.data;
  const isAdmin = g.myRole === "ADMIN";
  const cur = g.currency;
  const mine = s.results.find((r) => r.user.id === profile?.id);
  const ranked = [...s.results].sort((a, b) => {
    if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
    return (b.net ?? 0) - (a.net ?? 0);
  });
  const notSeated = g.members.filter((m) => !s.results.some((r) => r.user.id === m.user.id));

  return (
    <div>
      <PageHeader
        back={`/groups/${groupId}`}
        title={s.title ?? format(new Date(s.playedAt), "EEEE d MMMM")}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3">
            <span>{format(new Date(s.playedAt), "d MMM yyyy, HH:mm")}</span>
            {s.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {s.location}
              </span>
            ) : null}
            <span className="text-xs">by {s.createdBy.displayName}</span>
          </span>
        }
        actions={
          isAdmin ? (
            <>
              <EditSessionDialog groupId={groupId} session={s} onSaved={refresh} />
              <Button variant="ghost" size="icon" aria-label="Delete session" onClick={() => { if (confirm("Delete this session and all its results?")) del.mutate(); }}>
                <Trash2 className="text-loss" />
              </Button>
            </>
          ) : null
        }
      />

      {/* My result */}
      {mine ? (
        <Card className="mb-4 border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your result</CardTitle>
            <CardDescription>
              {mine.submitted ? "Submitted — you can still edit it." : "Enter what you bought in for (including rebuys) and what you left with."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResultForm groupId={groupId} sessionId={sessionId} row={mine} currency={cur} onSaved={refresh} />
          </CardContent>
        </Card>
      ) : null}

      {s.notes ? <p className="mb-4 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">{s.notes}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Results</CardTitle>
              <CardDescription>
                {s.submittedCount}/{s.playerCount} submitted
              </CardDescription>
            </div>
            {isAdmin && notSeated.length ? (
              <Select onValueChange={(id) => addPlayer.mutate(id)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={<span className="inline-flex items-center gap-1"><Plus className="size-4" /> Seat player</span>} />
                </SelectTrigger>
                <SelectContent>
                  {notSeated.map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {ranked.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-5 text-center text-sm tabular text-muted-foreground">{r.submitted ? i + 1 : "–"}</div>
                  <Link to={`/groups/${groupId}/players/${r.user.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
                    <UserAvatar name={r.user.displayName} src={r.user.avatarUrl} className="size-9" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.user.displayName}</div>
                      <div className="truncate text-xs tabular text-muted-foreground">
                        {r.submitted ? (
                          <>In {money(r.buyIn, cur)} · Out {money(r.cashOut, cur)}</>
                        ) : (
                          "Waiting for result"
                        )}
                      </div>
                    </div>
                  </Link>
                  {r.submitted ? (
                    <div className={cn("tabular font-semibold", netClass(r.net))}>{money(r.net, cur, { sign: true })}</div>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  {isAdmin ? (
                    <div className="flex items-center">
                      <AdminEditResult groupId={groupId} sessionId={sessionId} row={r} currency={cur} onSaved={refresh} />
                      <Button size="icon" variant="ghost" aria-label="Remove from session" onClick={() => removePlayer.mutate(r.user.id)}>
                        <UserMinus className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {s.results.length === 0 ? <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nobody seated yet.</div> : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Table</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Total buy-ins" value={money(s.totalBuyIn, cur)} />
              <Row label="Total cash-outs" value={money(s.totalCashOut, cur)} />
              {s.discrepancy != null ? (
                s.discrepancy === 0 ? (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-win/10 px-2.5 py-1.5 text-xs font-medium text-win">
                    <Check className="size-3.5" /> Table balances
                  </div>
                ) : (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-loss/10 px-2.5 py-1.5 text-xs font-medium text-loss">
                    <AlertTriangle className="size-3.5" /> Off by {money(s.discrepancy, cur, { sign: true })} — someone's number is wrong
                  </div>
                )
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">Balance check appears once everyone has submitted.</div>
              )}
            </CardContent>
          </Card>
          {s.topWinner ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Night's podium</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Podium label="Top winner" row={s.topWinner} cur={cur} />
                {s.topLoser ? <Podium label="Biggest loser" row={s.topLoser} cur={cur} /> : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

function Podium({ label, row, cur }: { label: string; row: SessionResultRow; cur: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <UserAvatar name={row.user.displayName} src={row.user.avatarUrl} className="size-7" textClassName="text-xs" />
        <span className="truncate">{row.user.displayName}</span>
        <span className={cn("ml-auto tabular font-semibold", netClass(row.net))}>{money(row.net, cur, { sign: true })}</span>
      </div>
    </div>
  );
}

function ResultForm({ groupId, sessionId, row, currency, onSaved, userId = "me", onDone }: { groupId: string; sessionId: string; row: SessionResultRow; currency: string; onSaved: () => void; userId?: string; onDone?: () => void }) {
  const [buyIn, setBuyIn] = useState(row.submitted || row.buyIn ? String(row.buyIn) : "");
  const [cashOut, setCashOut] = useState(row.cashOut != null ? String(row.cashOut) : "");
  useEffect(() => {
    setBuyIn(row.submitted || row.buyIn ? String(row.buyIn) : "");
    setCashOut(row.cashOut != null ? String(row.cashOut) : "");
  }, [row.id, row.buyIn, row.cashOut, row.submitted]);

  const save = useMutation({
    mutationFn: () => api.put(`/groups/${groupId}/sessions/${sessionId}/results/${userId}`, { buyIn: Number(buyIn), cashOut: Number(cashOut) }),
    onSuccess: () => { toast.success("Result saved"); onSaved(); onDone?.(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  const net = buyIn !== "" && cashOut !== "" ? Number(cashOut) - Number(buyIn) : null;

  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
    >
      <div className="space-y-1.5">
        <Label>Buy-in ({currency})</Label>
        <Input type="number" inputMode="decimal" min={0} step="0.01" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} placeholder="0" required />
      </div>
      <div className="space-y-1.5">
        <Label>Cash-out ({currency})</Label>
        <Input type="number" inputMode="decimal" min={0} step="0.01" value={cashOut} onChange={(e) => setCashOut(e.target.value)} placeholder="0" required />
      </div>
      <div className="col-span-2 sm:col-span-1 sm:pb-2 text-sm">
        <span className="text-muted-foreground">Net </span>
        <span className={cn("tabular font-semibold", netClass(net))}>{money(net, currency, { sign: true })}</span>
      </div>
      <Button type="submit" loading={save.isPending} className="col-span-2 sm:col-span-1">
        {row.submitted ? "Update" : "Submit"}
      </Button>
    </form>
  );
}

function AdminEditResult({ groupId, sessionId, row, currency, onSaved }: { groupId: string; sessionId: string; row: SessionResultRow; currency: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Edit result">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Result for {row.user.displayName}</DialogTitle>
          <DialogDescription>Admins can fill this in on a player's behalf.</DialogDescription>
        </DialogHeader>
        <ResultForm groupId={groupId} sessionId={sessionId} row={row} currency={currency} onSaved={onSaved} userId={row.user.id} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditSessionDialog({ groupId, session, onSaved }: { groupId: string; session: Session; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(session.title ?? "");
  const [location, setLocation] = useState(session.location ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [playedAt, setPlayedAt] = useState(format(new Date(session.playedAt), "yyyy-MM-dd'T'HH:mm"));
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/groups/${groupId}/sessions/${session.id}`, {
        title: title || null,
        location: location || null,
        notes: notes || null,
        playedAt: new Date(playedAt).toISOString(),
      }),
    onSuccess: () => { toast.success("Session updated"); onSaved(); setOpen(false); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit game day</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date & time</Label>
              <Input type="datetime-local" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
