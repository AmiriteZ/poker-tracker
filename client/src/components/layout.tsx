import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { LogOut, Moon, Sun, Monitor, User, Users, Dice5, LayoutGrid } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/", label: "Groups", icon: LayoutGrid, end: true },
  { to: "/solo", label: "Solo", icon: Dice5 },
  { to: "/profile", label: "Profile", icon: User },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} title={`Theme: ${theme}`} aria-label="Toggle theme">
      <Icon />
    </Button>
  );
}

export function AppLayout() {
  const { profile, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const name = profile?.displayName ?? firebaseUser?.displayName ?? "You";

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b glass">
        <div className="container flex h-14 items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <img src="/chip.svg" alt="" className="size-6" />
            <span>Poker Ledger</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <UserAvatar name={name} src={profile?.avatarUrl} className="size-8" textClassName="text-xs" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate">
                  <div className="text-sm">{name}</div>
                  <div className="text-xs font-normal text-muted-foreground truncate">{profile?.email ?? firebaseUser?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User /> My profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/")}>
                  <Users /> My groups
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut(auth)}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-6 pb-24 md:pb-8 animate-fade-in">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t glass md:hidden">
        <div className="grid grid-cols-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-1 py-2 text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")
              }
            >
              <n.icon className="size-5" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back ? (
          <Link to={back} className="text-xs text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight truncate sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-primary/10 p-3">
        <Icon className="size-6 text-primary" />
      </div>
      <div className="font-semibold">{title}</div>
      {body ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
