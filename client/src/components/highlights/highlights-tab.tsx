import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clapperboard, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Highlight, PublicUser } from "@/lib/types";
import type { Card } from "@/lib/cards";
import { Button } from "@/components/ui/button";
import { Card as UiCard, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/layout";
import { Reveal, staggerDelay } from "@/components/ui/reveal";
import { PlayingCard } from "./playing-card";
import { HighlightEditor } from "./highlight-editor";
import { HighlightPlayer } from "./highlight-player";

export function HighlightsTab({
  groupId,
  sessionId,
  seatedPlayers,
  canManage,
}: {
  groupId: string;
  sessionId: string;
  seatedPlayers: PublicUser[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Highlight | "new" | null>(null);
  const [watching, setWatching] = useState<Highlight | null>(null);

  const highlights = useQuery({
    queryKey: ["highlights", sessionId],
    queryFn: () => api.get<Highlight[]>(`/groups/${groupId}/sessions/${sessionId}/highlights`),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${groupId}/sessions/${sessionId}/highlights/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["highlights", sessionId] });
      toast.success("Highlight deleted");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not delete the highlight"),
  });

  if (highlights.isLoading) return <Skeleton className="h-40" />;
  const list = highlights.data ?? [];

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus /> Create highlight
          </Button>
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No highlights yet"
          body={canManage ? "Capture a memorable hand from this game day — pick the board, the players, and when each hand was revealed." : "Nobody's captured a hand from this game day yet."}
          action={canManage ? <Button onClick={() => setEditing("new")}><Plus /> Create highlight</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((h, i) => (
            <Reveal key={h.id} delay={staggerDelay(i, 40, 250)}>
              <UiCard className="overflow-hidden transition-shadow hover:shadow-card-hover">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{h.title || "Untitled highlight"}</div>
                      <div className="text-xs text-muted-foreground">by {h.createdBy.displayName}</div>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0">
                        <Button size="icon" variant="ghost" aria-label="Edit highlight" onClick={() => setEditing(h)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete highlight"
                          onClick={() => {
                            if (confirm("Delete this highlight?")) del.mutate(h.id);
                          }}
                        >
                          <Trash2 className="size-4 text-loss" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-center gap-1 rounded-lg bg-muted/40 p-2">
                    {h.cards.map((c, idx) => (
                      <PlayingCard key={idx} card={c as Card} widthClassName="w-8 sm:w-9" />
                    ))}
                  </div>

                  {h.players.length ? (
                    <div className="flex items-center -space-x-2">
                      {h.players.slice(0, 6).map((p) => (
                        <UserAvatar key={p.id} name={p.user.displayName} src={p.user.avatarUrl} className="size-7 border-2 border-card" textClassName="text-[10px]" />
                      ))}
                      {h.players.length > 6 ? (
                        <span className="ml-3 text-xs text-muted-foreground">+{h.players.length - 6} more</span>
                      ) : null}
                    </div>
                  ) : null}

                  <Button className="w-full" variant="secondary" onClick={() => setWatching(h)}>
                    <Play /> Watch
                  </Button>
                </CardContent>
              </UiCard>
            </Reveal>
          ))}
        </div>
      )}

      {editing ? (
        <HighlightEditor
          groupId={groupId}
          sessionId={sessionId}
          seatedPlayers={seatedPlayers}
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : null}

      {watching ? (
        <Dialog open onOpenChange={(o) => !o && setWatching(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{watching.title || "Highlight"}</DialogTitle>
              <DialogDescription>by {watching.createdBy.displayName}</DialogDescription>
            </DialogHeader>
            <HighlightPlayer highlight={watching} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
