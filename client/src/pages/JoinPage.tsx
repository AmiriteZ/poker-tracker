import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Landing page for invite links: /join/:code */
export function JoinPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const preview = useQuery({
    queryKey: ["group-preview", code],
    queryFn: () => api.get<{ id: string; name: string; description: string | null; memberCount: number }>(`/groups/preview/${code}`),
    retry: false,
  });
  const join = useMutation({
    mutationFn: () => api.post<{ groupName: string; status: string }>("/groups/join", { code }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success(`Request sent to ${r.groupName}. An admin will confirm you.`);
      navigate("/");
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Could not join");
      if (e instanceof ApiError && e.status === 400) navigate("/");
    },
  });

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mb-2 rounded-full bg-secondary p-3">
            <Users className="size-6" />
          </div>
          {preview.isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : preview.error ? (
            <>
              <CardTitle>Invite not found</CardTitle>
              <CardDescription>The code <span className="font-mono">{code}</span> doesn't match any group. Ask the admin for a fresh link.</CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Join {preview.data?.name}</CardTitle>
              <CardDescription>
                {preview.data?.description ? <>{preview.data.description} · </> : null}
                {preview.data?.memberCount} member{preview.data?.memberCount === 1 ? "" : "s"}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {preview.data ? (
            <Button onClick={() => join.mutate()} loading={join.isPending}>
              Request to join
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => navigate("/")}>
            Back to my groups
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">An admin has to confirm you before you can see the group.</p>
        </CardContent>
      </Card>
    </div>
  );
}
