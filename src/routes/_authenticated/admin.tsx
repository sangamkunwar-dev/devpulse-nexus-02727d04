import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield, Users, GitPullRequest, NotebookPen, Code2, FolderKanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

function useIsAdmin(userId: string | null) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: userId!, _role: "admin" });
      if (error) throw error;
      return !!data;
    },
  });
}

function AdminPage() {
  const { userId, loading } = useSession();
  const { data: isAdmin, isLoading: checkingRole } = useIsAdmin(userId);

  const stats = useQuery({
    queryKey: ["admin-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const [users, reviews, notes, snippets, projects] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("review_requests").select("*", { count: "exact", head: true }),
        supabase.from("notes").select("*", { count: "exact", head: true }),
        supabase.from("snippets").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        reviews: reviews.count ?? 0,
        notes: notes.count ?? 0,
        snippets: snippets.count ?? 0,
        projects: projects.count ?? 0,
      };
    },
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, xp, is_public, created_at")
        .order("xp", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (loading || checkingRole) return <AppShell title="Admin"><Skeleton className="h-96 w-full" /></AppShell>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const cards = [
    { label: "Users", value: stats.data?.users, icon: Users },
    { label: "Reviews", value: stats.data?.reviews, icon: GitPullRequest },
    { label: "Notes", value: stats.data?.notes, icon: NotebookPen },
    { label: "Snippets", value: stats.data?.snippets, icon: Code2 },
    { label: "Projects", value: stats.data?.projects, icon: FolderKanban },
  ];

  return (
    <AppShell title="Admin">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-2xl font-bold">Control Room</h2>
            <p className="text-sm text-muted-foreground">Manage essential platform activity and users.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className="bento-card p-4">
              <card.icon className="h-4 w-4 text-muted-foreground" />
              <div className="mt-2 font-display text-2xl font-bold">{card.value ?? "…"}</div>
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="bento-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Top users</h3>
              <p className="mt-1 text-xs text-muted-foreground">Users ranked by experience points.</p>
            </div>
            <Badge variant="accent">Admin only</Badge>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {users.data?.slice(0, 10).map((user) => (
              <div key={user.user_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{user.display_name ?? user.username}</div>
                  <div className="text-xs text-muted-foreground">@{user.username}</div>
                </div>
                <div className="flex items-center gap-2">
                  {user.is_public && <Badge variant="outline" className="text-[10px]">public</Badge>}
                  <span className="font-mono text-xs">{user.xp} XP</span>
                </div>
              </div>
            ))}
            {!users.data?.length && <p className="text-sm text-muted-foreground">No users found.</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
