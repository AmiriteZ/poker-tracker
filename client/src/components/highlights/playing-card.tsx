import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cardBackSrc, cardImageSrc, cardLabel, type Card } from "@/lib/cards";
import { cn } from "@/lib/utils";

const FLIP_HALF_MS = 220;

/**
 * A single playing card, always scaled uniformly by width — height follows from the
 * fixed 5:7 source aspect ratio, so a card never looks stretched. Pass `faceUp` to
 * flip from the back image to the face image (used by the highlight animation); a
 * static card (in the editor, in a saved-highlight summary) can just render with
 * `faceUp` fixed to true and no `animated` prop.
 *
 * The flip is a horizontal squeeze-and-release (scaleX 1 → 0 → 1), swapping which
 * image is shown at the pinch point, rather than a true 3D rotateY/backface-visibility
 * flip. That 3D technique reads a little more real, but it turned out to silently fail
 * to paint the card image at all on some Chromium builds without GPU compositing
 * (software rendering falls back to a broken-image icon instead of the face) — a real
 * risk on the range of devices/browsers this feature needs to run on. A 2D scale never
 * touches that code path, so it's guaranteed to render everywhere.
 */
export function PlayingCard({
  card,
  faceUp = true,
  animated = false,
  widthClassName = "w-14",
  className,
}: {
  card: Card;
  faceUp?: boolean;
  animated?: boolean;
  widthClassName?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(faceUp);
  const [pinched, setPinched] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setShown(faceUp);
      return;
    }
    if (shown === faceUp) return;
    if (!animated) {
      setShown(faceUp);
      return;
    }
    setPinched(true);
    const t = setTimeout(() => {
      setShown(faceUp);
      setPinched(false);
    }, FLIP_HALF_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceUp]);

  const src = shown ? cardImageSrc(card) : cardBackSrc;
  return (
    <div className={cn(widthClassName, "shrink-0", className)}>
      <img
        src={src}
        alt={shown ? cardLabel(card) : ""}
        className={cn(
          "aspect-[5/7] w-full rounded-[10%] object-cover drop-shadow-md",
          animated && "transition-transform ease-in-out"
        )}
        style={animated ? { transform: `scaleX(${pinched ? 0 : 1})`, transitionDuration: `${FLIP_HALF_MS}ms` } : undefined}
      />
    </div>
  );
}

/**
 * An empty community/hole-card slot — dashed outline with a plus, matching the app's EmptyState language.
 * Width comes from `widthClassName` alone (no `w-full` here — tailwind-merge keeps the *last* width
 * class, so a `w-full` would silently override the caller's `w-9` and let the slot grow into its
 * neighbours; that's exactly how the second hole-card slot ended up sitting on top of the remove button).
 */
export function EmptyCardSlot({ widthClassName = "w-14", className, onClick, label }: { widthClassName?: string; className?: string; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? "Add card"}
      className={cn(
        "flex aspect-[5/7] shrink-0 items-center justify-center rounded-[10%] border-2 border-dashed border-muted-foreground/30 bg-black/5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary dark:bg-white/5",
        widthClassName,
        className
      )}
    >
      <Plus className="size-1/3" />
    </button>
  );
}
