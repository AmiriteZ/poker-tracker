import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, initials } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/** Convenience wrapper: image with initials fallback. Pass `ring="admin"` to add a brass ring for standout roles. */
export function UserAvatar({
  name,
  src,
  className,
  textClassName,
  ring,
}: {
  name: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
  ring?: "admin" | "organiser";
}) {
  return (
    <Avatar
      className={cn(
        ring === "admin" && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
        ring === "organiser" && "ring-2 ring-muted-foreground/30 ring-offset-2 ring-offset-background",
        className
      )}
    >
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={textClassName}>{initials(name) || "?"}</AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
