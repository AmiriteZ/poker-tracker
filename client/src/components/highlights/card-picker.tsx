import { RANKS, SUITS, SUIT_LABEL, SUIT_SYMBOL, cardImageSrc, cardLabel, cardsEqual, isRedSuit, type Card } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * A 52-card picker grouped by suit. Cards already used elsewhere in the highlight being
 * edited are dimmed and unclickable — a highlight can't reuse a card, same as a real deck —
 * except the slot's own current card, which stays selectable (re-picking it, or picking a
 * different one, both just work).
 */
export function CardPicker({
  open,
  onOpenChange,
  usedCards,
  current,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usedCards: Card[];
  current?: Card | null;
  onSelect: (card: Card) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a card</DialogTitle>
          <DialogDescription>Cards already used elsewhere in this highlight are greyed out.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SUITS.map((suit) => (
            <div key={suit} className="space-y-1.5">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <span className={cn(isRedSuit(suit) ? "text-loss" : "text-foreground")}>{SUIT_SYMBOL[suit]}</span>
                {SUIT_LABEL[suit]}
              </div>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-3">
                {RANKS.map((rank) => {
                  const card: Card = { rank, suit };
                  const isCurrent = cardsEqual(current, card);
                  const disabled = !isCurrent && usedCards.some((u) => cardsEqual(u, card));
                  return (
                    <button
                      key={rank}
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelect(card)}
                      aria-label={cardLabel(card)}
                      className={cn(
                        "overflow-hidden rounded-[10%] border transition-transform hover:-translate-y-0.5 hover:shadow-card",
                        disabled ? "pointer-events-none opacity-20" : "cursor-pointer",
                        isCurrent ? "ring-2 ring-primary" : "border-border"
                      )}
                    >
                      <img src={cardImageSrc(card)} alt="" className="aspect-[5/7] w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
