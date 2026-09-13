import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, KeyRound, Crown, Clock, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { GroupListItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/layout";

export function GroupsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["groups"], queryFn: () => api.get<GroupListItem[]>("/groups") });
  const approved = data?.filter((g) => g.status === "APPROVED") ?? [];
  const pending = data?.filter((g) => g.status === "PENDING") ?? [];

  return (
    <div>
      <PageHeader
        title="Your groups"
        subtitle="Each crew gets its own ledger. Join with a code or start a new one."
        actions={
          <>
            <JoinDialog />
            <CreateDialog />
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : approved.length === 0 && pending.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          body="Create a group for your home game, or enter the code an admin sent you."
          action={
            <div className="flex gap-2">
              <JoinDialog />
              <CreateDialog />
            </div>
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approved.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold">{g.name}</div>
                    {g.description ? <div className="truncate text-sm text-muted-foreground">{g.description}</div> : null}
                  </div>
                  {g.role === "ADMIN" ? (
                    <Badge variant="secondary" className="gap-1 shrink-0">
                      <Crown className="size-3" /> Admin
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-5 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-4" /> {g.memberCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-4" /> {g.sessionCount}
                  </span>
                  {g.pendingRequests > 0 ? (
                    <Badge className="ml-auto" variant="default">
                      {g.pendingRequests} request{g.pendingRequests > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>

          {pending.length ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Awaiting approval</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 rounded-xl border border-dashed p-4">
                    <Clock className="size-5 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">An admin needs to confirm you</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CreateDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("€");
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/groups", { name, description: description || undefined, currency }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created");
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not create group"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Create a group</DialogTitle>
            <DialogDescription>You'll be the admin. Share the code with your friends afterwards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gname">Name</Label>
            <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Thursday night crew" required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gdesc">Description (optional)</Label>
            <Input id="gdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="€20 buy-in, no rebuys after 11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gcur">Currency symbol</Label>
            <Input id="gcur" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24" maxLength={4} required />
          </div>
          <DialogFooter>
            <Button type="submit" loading={create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function JoinDialog({ initialCode = "", trigger }: { initialCode?: string; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(initialCode);
  const join = useMutation({
    mutationFn: () => api.post<{ groupName: string }>("/groups/join", { code: extractCode(code) }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success(`Request sent to ${r.groupName}. An admin will confirm you.`);
      setOpen(false);
      setCode("");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not join"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <KeyRound /> Join with code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            join.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Join a group</DialogTitle>
            <DialogDescription>Paste the invite link or type the code the admin gave you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="code">Code or link</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC1234" className="font-mono uppercase tracking-widest" required />
          </div>
          <DialogFooter>
            <Button type="submit" loading={join.isPending}>
              Request to join
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Accepts a bare code or a full invite URL like https://app/join/ABC1234 */
export function extractCode(input: string) {
  const trimmed = input.trim();
  const m = trimmed.match(/join\/([A-Za-z0-9]+)/);
  return (m ? m[1] : trimmed).toUpperCase();
}
