import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in ms — pass `index * 40` (capped) when revealing a list. */
  delay?: number;
  className?: string;
  as?: ElementType;
}

/**
 * Fades + rises its children into view the first time they cross into the viewport.
 * A pure CSS class toggle (see `.reveal` / `.reveal-visible` in index.css) — no animation
 * library, GPU-cheap opacity/transform only, and fully disabled under prefers-reduced-motion.
 * Once revealed it stays revealed (one-shot), so re-renders never re-trigger the animation.
 */
export function Reveal({ children, delay = 0, className, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", visible && "reveal-visible", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Caps per-item stagger so a long list doesn't take forever to finish revealing. */
export function staggerDelay(index: number, step = 40, max = 320) {
  return Math.min(index * step, max);
}
