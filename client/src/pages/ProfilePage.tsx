import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Pencil, Users, Dice5, Layers } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MyStats, PublicUser } from "@/lib/types";
import { cn, money, netClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatsPanel } from "@/components/stats";

interface SignResponse {
  timestamp: number;
  folder: string;
  public_id: string;
  overwrite: string;
  transformation: string;
  signature: string;
  apiKey: string;
  cloudName: string;
}

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const stats = useQuery({ queryKey: ["my-stats"], queryFn: () => api.get<MyStats>("/me/stats") });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const sig = await api.post<SignResponse>("/me/avatar/sign");
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      form.append("public_id", sig.public_id);
      form.append("overwrite", sig.overwrite);
      form.append("transformation", sig.transformation);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
      // Cache-bust so the new image shows immediately even though public_id is reused.
      const url = `${data.secure_url}?v=${data.version}`;
      await api.patch("/me", { avatarUrl: url });
      refreshProfile();
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!profile) return <Skeleton className="h-96" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <button
          className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile picture"
        >
          <UserAvatar name={profile.displayName} src={profile.avatarUrl} className="size-20" textClassName="text-2xl" />
          <span className={cn("absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100", uploading && "opacity-100")}>
            <Camera className="size-6" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="truncate">{profile.displayName}</span>
            <EditNameDialog profile={profile} onSaved={refreshProfile} />
          </h1>
          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
        </div>
        {/* On phones this lives in the stat grid instead (see StatTiles `extra`) */}
        {stats.data ? (
          <div className="hidden rounded-xl border bg-card px-5 py-3 text-right md:block">
            <div className="text-xs text-muted-foreground">All-time net</div>
            <div className={cn("text-2xl font-bold tabular", netClass(stats.data.all.summary.net))}>{money(stats.data.all.summary.net, "€", { sign: true })}</div>
          </div>
        ) : null}
      </div>

      {stats.isLoading || !stats.data ? (
        <Skeleton className="h-96" />
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              <Layers className="size-4" /> Everything
            </TabsTrigger>
            <TabsTrigger value="groups">
              <Users className="size-4" /> Groups
            </TabsTrigger>
            <TabsTrigger value="solo">
              <Dice5 className="size-4" /> Solo
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <p className="mb-4 text-xs text-muted-foreground">Combined across every group and your solo games. Currency symbols are shown as € here; each group keeps its own.</p>
            <StatsPanel block={stats.data.all} />
          </TabsContent>
          <TabsContent value="groups" className="space-y-4">
            <StatsPanel block={stats.data.groups} allTimeNet={stats.data.all.summary.net} />
            {stats.data.byGroup.length ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">By group</CardTitle>
                  <CardDescription>Your record in each crew.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {stats.data.byGroup.map((g) => (
                      <Link key={g.groupId} to={`/groups/${g.groupId}/players/${profile.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-accent/50">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{g.groupName}</div>
                          <div className="text-xs text-muted-foreground">
                            {g.summary.submitted} sessions · {g.summary.wins}W {g.summary.losses}L
                          </div>
                        </div>
                        <div className={cn("tabular font-semibold", netClass(g.summary.net))}>{money(g.summary.net, "€", { sign: true })}</div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
          <TabsContent value="solo">
            <StatsPanel block={stats.data.solo} allTimeNet={stats.data.all.summary.net} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EditNameDialog({ profile, onSaved }: { profile: PublicUser; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const save = useMutation({
    mutationFn: () => api.patch("/me", { displayName: name }),
    onSuccess: () => { onSaved(); setOpen(false); toast.success("Name updated"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Edit name">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Display name</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dn">Name</Label>
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={40} />
          </div>
          <DialogFooter>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
