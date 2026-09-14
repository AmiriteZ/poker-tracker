import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, UserMinus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Highlight, PublicUser, RevealStage } from "@/lib/types";
import { COMMUNITY_LABELS, REVEAL_STAGE_LABEL, type Card } from "@/lib/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayingCard, EmptyCardSlot } from "./playing-card";
import { CardPicker } from "./card-picker";

interface EditorPlayer {
  userId: string;
  user: PublicUser;
  revealedAt: RevealStage;
  hole1: Card | null;
  hole2: Card | null;
}

export function HighlightEditor({
  groupId,
  sessionId,
  seatedPlayers,
  initial,
  onClose,
  onSaved,
}: {
  groupId: string;
  sessionId: string;
  seatedPlayers: PublicUser[];
  initial?: Highlight;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [cards, setCards] = useState<(Card | null)[]>(() => {
    const base: (Card | null)[] = [null, null, null, null, null];
    initial?.cards.forEach((c, i) => (base[i] = c as Card));
    return base;
  });
  const [players, setPlayers] = useState<EditorPlayer[]>(
    () => initial?.players.map((p) => ({ userId: p.user.id, user: p.user, revealedAt: p.revealedAt, hole1: p.hole1 as Card | null, hole2: p.hole2 as Card | null })) ?? []
  );
  const [addPlayerId, setAddPlayerId] = useState("");
  const [picker, setPicker] = useState<{ kind: "community"; index: number } | { kind: "hole"; userId: string; slot: 1 | 2 } | null>(null);

  const allChosenCards = () => [...cards, ...players.flatMap((p) => [p.hole1, p.hole2])].filter((c): c is Card => !!c);

  const availableToAdd = seatedPlayers.filter((u) => !players.some((p) => p.userId === u.id));

  const addPlayer = () => {
    const user = seatedPlayers.find((u) => u.id === addPlayerId);
    if (!user) return;
    setPlayers((prev) => [...prev, { userId: user.id, user, revealedAt: "START", hole1: null, hole2: null }]);
    setAddPlayerId("");
  };

  const removePlayer = (userId: string) => setPlayers((prev) => prev.filter((p) => p.userId !== userId));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim() || null,
        cards: cards.map((c) => c!), // guarded by `canSave` below
        players: players.map((p) => ({ userId: p.userId, revealedAt: p.revealedAt, hole1: p.hole1, hole2: p.hole2 })),
      };
      return initial
        ? api.patch<Highlight>(`/groups/${groupId}/sessions/${sessionId}/highlights/${initial.id}`, body)
        : api.post<Highlight>(`/groups/${groupId}/sessions/${sessionId}/highlights`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["highlights", sessionId] });
      toast.success(initial ? "Highlight updated" : "Highlight created");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save the highlight"),
  });

  const canSave = cards.every((c) => c !== null);

  // The slot's own current card is excluded at the call site (via the `current` prop
  // comparison below) so it stays selectable instead of showing as "used".
  const pickerUsedCards = () => allChosenCards();

  const pickerCurrent: Card | null =
    picker == null
      ? null
      : picker.kind === "community"
        ? cards[picker.index]
        : (players.find((p) => p.userId === picker.userId)?.[picker.slot === 1 ? "hole1" : "hole2"] ?? null);

  const applyPick = (card: Card) => {
    if (!picker) return;
    if (picker.kind === "community") {
      setCards((prev) => prev.map((c, i) => (i === picker.index ? card : c)));
    } else {
      setPlayers((prev) => prev.map((p) => (p.userId === picker.userId ? { ...p, [picker.slot === 1 ? "hole1" : "hole2"]: card } : p)));
    }
    setPicker(null);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (canSave) save.mutate(); }} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{initial ? "Edit highlight" : "Create highlight"}</DialogTitle>
            <DialogDescription>Add the five community cards, then the players whose hands were part of this one.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="htitle">Title (optional)</Label>
            <Input id="htitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The river bluff" maxLength={80} />
          </div>

          <div className="space-y-2">
            <Label>Community cards</Label>
            <div className="flex justify-center gap-2 rounded-xl border bg-muted/30 p-4 sm:gap-3">
              {cards.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  {c ? (
                    <button type="button" onClick={() => setPicker({ kind: "community", index: i })} className="transition-transform hover:-translate-y-0.5">
                      <PlayingCard card={c} widthClassName="w-12 sm:w-16" />
                    </button>
                  ) : (
                    <EmptyCardSlot widthClassName="w-12 sm:w-16" onClick={() => setPicker({ kind: "community", index: i })} label={`Add ${COMMUNITY_LABELS[i]} card`} />
                  )}
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{COMMUNITY_LABELS[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Players in this hand ({players.length})</Label>
              {availableToAdd.length ? (
                <div className="flex items-center gap-1">
                  <Select value={addPlayerId} onValueChange={setAddPlayerId}>
                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Choose a player" /></SelectTrigger>
                    <SelectContent>
                      {availableToAdd.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="secondary" disabled={!addPlayerId} onClick={addPlayer}>
                    <Plus /> Add
                  </Button>
                </div>
              ) : null}
            </div>

            {players.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No players added yet — the highlight can still be saved with just the board.
              </p>
            ) : (
              <div className="space-y-2">
                {players.map((p) => (
                  <div key={p.userId} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                    <UserAvatar name={p.user.displayName} src={p.user.avatarUrl} className="size-8" />
                    <div className="min-w-0 flex-1 font-medium">{p.user.displayName}</div>
                    <Select value={p.revealedAt} onValueChange={(v) => setPlayers((prev) => prev.map((x) => (x.userId === p.userId ? { ...x, revealedAt: v as RevealStage } : x)))}>
                      <SelectTrigger className="h-8 w-40 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["START", "FLOP", "TURN", "RIVER"] as const).map((stage) => (
                          <SelectItem key={stage} value={stage}>{REVEAL_STAGE_LABEL[stage]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                      {([1, 2] as const).map((slot) => {
                        const c = slot === 1 ? p.hole1 : p.hole2;
                        return c ? (
                          <button key={slot} type="button" onClick={() => setPicker({ kind: "hole", userId: p.userId, slot })} className="transition-transform hover:-translate-y-0.5">
                            <PlayingCard card={c} widthClassName="w-9" />
                          </button>
                        ) : (
                          <EmptyCardSlot key={slot} widthClassName="w-9" onClick={() => setPicker({ kind: "hole", userId: p.userId, slot })} label="Add hole card" />
                        );
                      })}
                    </div>
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove player" onClick={() => removePlayer(p.userId)}>
                      <UserMinus className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {!canSave ? <p className="mr-auto self-center text-xs text-muted-foreground">Add all 5 community cards to save.</p> : null}
            <Button type="submit" disabled={!canSave} loading={save.isPending}>
              {initial ? "Save changes" : "Create highlight"}
            </Button>
          </DialogFooter>
        </form>

        {picker ? (
          <CardPicker
            open
            onOpenChange={(o) => !o && setPicker(null)}
            usedCards={pickerUsedCards().filter((c) => !(pickerCurrent && c.rank === pickerCurrent.rank && c.suit === pickerCurrent.suit))}
            current={pickerCurrent}
            onSelect={applyPick}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
