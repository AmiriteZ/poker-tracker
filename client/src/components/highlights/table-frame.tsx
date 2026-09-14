import tableFelt from "@/assets/images/table/green-textured-surface.png";
import { cn } from "@/lib/utils";

/**
 * The felt "table" the highlight's cards sit on. The source image doesn't need to match
 * this container's size — it's a tileable-looking texture stretched to cover — and it's
 * wrapped in a brass rail + rounded frame to match the app's Lounge Ledger theme rather
 * than looking like a bare dropped-in photo.
 */
export function TableFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[2rem] bg-gradient-to-br from-primary/80 via-[#3b2a12] to-black/80 p-1.5 shadow-card-hover sm:p-2", className)}>
      <div className="relative overflow-hidden rounded-[1.6rem]">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${tableFelt})` }} aria-hidden />
        <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.45)]" aria-hidden />
        <div className="relative px-3 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
