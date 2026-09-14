import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dice5, Info, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { SoloGame, SoloResponse } from "@/lib/types";
import { cn, money, netClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/layout";
import { StatsPanel } from "@/components/stats";
import { Reveal, staggerDelay } from "@/components/ui/reveal";

export function SoloPage() {
  const qc = useQueryClient();
  const solo = useQuery({ queryKey: ["solo"], queryFn: () => api.get<SoloResponse>("/solo") });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["solo"] });
    qc.invalidateQueries({ queryKey: ["my-stats"] });
  };
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/solo/${id}`),
    onSuccess: () => { refresh(); toast.success("Game deleted"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not delete"),
  });

  return (
    <div>
      <PageHeader
        title="Solo games"
        subtitle="Casino trips, online sessions, games with people outside your groups."
        actions={<GameDialog onSaved={refresh} />}
      />

      <div className="mb-5 flex gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          <span className="font-medium">Only log games that aren't part of a group.</span> If you played on a group's game day, enter your result on that
          session instead — otherwise it'll be counted twice in your all-time totals.
        </p>
      </div>

      {solo.isLoading || !solo.data ? (
        <Skeleton className="h-96" />
      ) : solo.data.games.length === 0 ? (
        <EmptyState icon={Dice5} title="No solo games yet" body="Log a game you played outside your groups to track it here." action={<GameDialog onSaved={refresh} />} />
      ) : (
        <div className="space-y-4">
          <StatsPanel block={solo.data} title="Solo profit over time" />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All solo games</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {solo.data.games.map((g, i) => (
                  <Reveal key={g.id} delay={staggerDelay(i, 35, 250)} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="w-24 shrink-0 text-muted-foreground">{format(new Date(g.playedAt), "d MMM yyyy")}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 truncate">
                        {g.location ? (
                          <>
                            <MapPin className="size-3.5 text-muted-foreground" /> {g.location}
                          </>
                        ) : (
                          <span className="text-muted-foreground">No location</span>
                        )}
                      </div>
                      {g.notes ? <div className="truncate text-xs text-muted-foreground">{g.notes}</div> : null}
                    </div>
                    <div className="hidden tabular text-xs text-muted-foreground sm:block">
                      {money(g.buyIn)} → {money(g.cashOut)}
                    </div>
                    <div className={cn("tabular font-semibold", netClass(g.net))}>{money(g.net, "€", { sign: true })}</div>
                    <GameDialog game={g} onSaved={refresh} />
                    <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => { if (confirm("Delete this game?")) del.mutate(g.id); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </Reveal>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function GameDialog({ game, onSaved }: { game?: SoloGame; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [playedAt, setPlayedAt] = useState(format(game ? new Date(game.playedAt) : new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [location, setLocation] = useState(game?.location ?? "");
  const [notes, setNotes] = useState(game?.notes ?? "");
  const [buyIn, setBuyIn] = useState(game ? String(game.buyIn) : "");
  const [cashOut, setCashOut] = useState(game ? String(game.cashOut) : "");

  const save = useMutation({
    mutationFn: () => {
      const body = { playedAt: new Date(playedAt).toISOString(), location: location || null, notes: notes || null, buyIn: Number(buyIn), cashOut: Number(cashOut) };
      return game ? api.patch(`/solo/${game.id}`, body) : api.post("/solo", body);
    },
    onSuccess: () => {
      onSaved();
      setOpen(false);
      toast.success(game ? "Game updated" : "Game logged");
      if (!game) { setBuyIn(""); setCashOut(""); setLocation(""); setNotes(""); }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  const net = buyIn !== "" && cashOut !== "" ? Number(cashOut) - Number(buyIn) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {game ? (
          <Button size="icon" variant="ghost" aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus /> Log a game
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{game ? "Edit solo game" : "Log a solo game"}</DialogTitle>
            <DialogDescription>Don't add games that were part of a group's game day.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date & time</Label>
              <Input type="datetime-local" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Casino, online, a mate's place" />
            </div>
            <div className="space-y-1.5">
              <Label>Buy-in (€)</Label>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Cash-out (€)</Label>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={cashOut} onChange={(e) => setCashOut(e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="items-center sm:justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Net </span>
              <span className={cn("tabular font-semibold", netClass(net))}>{money(net, "€", { sign: true })}</span>
            </div>
            <Button type="submit" loading={save.isPending}>{game ? "Save" : "Log game"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
