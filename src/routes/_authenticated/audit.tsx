import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Sparkles, Trash2, Rocket, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Admin Audit Log — DevPulse" },
      { name: "description", content: "Chronological record of template changes, daily bug publishes, and solved challenges." },
      { property: "og:title", content: "Admin Audit Log — DevPulse" },
      { property: "og:description", content: "Every admin-relevant event on DevPulse, in one timeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "challenge.published", label: "Published" },
  { key: "template.created", label: "Template added" },
  { key: "template.deleted", label: "Template deleted" },
  { key: "attempt.correct", label: "Correct answers" },
] as const;

const META: Record<string, { icon: typeof Rocket; tone: string; label: string }> = {
  "challenge.published": { icon: Rocket, tone: "text-primary", label: "Daily Bug published" },
  "template.created": { icon: Sparkles, tone: "text-accent", label: "Template created" },
  "template.deleted": { icon: Trash2, tone: "text-destructive", label: "Template deleted" },
  "attempt.correct": { icon: CheckCircle2, tone: "text-primary", label: "Correct answer" },
};

function AuditPage() {
  const { userId, loading } = useSession();
  const [filter, setFilter] = useState<string>("all");

  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: userId!, _role: "admin" });
      if (error) throw error;
      return !!data;
    },
  });

  const events = useQuery({
    queryKey: ["audit-log", filter],
    enabled: !!isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("admin_audit_log")
        .select("id, event_type, actor_id, subject, details, created_at")
        .order("created_at", { ascending: false })
        .limit(150);
      if (filter !== "all") q = q.eq("event_type", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (loading || checkingRole) {
    return (
      <AppShell title="Audit Log">
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell title="Audit Log">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-bold">Activity timeline</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>

        {events.isLoading && <Skeleton className="h-72 w-full" />}

        <div className="bento-card divide-y divide-border p-0">
          {events.data?.map((e) => {
            const m = META[e.event_type] ?? { icon: ScrollText, tone: "text-muted-foreground", label: e.event_type };
            const Icon = m.icon;
            const details = (e.details ?? {}) as Record<string, unknown>;
            return (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.tone}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{e.subject ?? "—"}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                    {Object.entries(details)
                      .filter(([k]) => k !== "template_id" && k !== "challenge_id")
                      .map(([k, v]) => (
                        <span key={k}>
                          {k}: {String(v)}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </div>
              </div>
            );
          })}
          {!events.isLoading && !events.data?.length && (
            <div className="p-10 text-center text-sm text-muted-foreground">No events recorded yet.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
