import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, BookOpen, Code2, FileText, GitPullRequest, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

type HistoryItem = {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
  icon: typeof FileText;
};

function HistoryPage() {
  const { userId } = useSession();
  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["user-history", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<HistoryItem[]> => {
      const [notes, snippets, projects, reviews, enrollments] = await Promise.all([
        supabase.from("notes").select("id, title, created_at").eq("user_id", userId!).eq("is_deleted", false).order("created_at", { ascending: false }).limit(20),
        supabase.from("snippets").select("id, title, created_at").eq("user_id", userId!).order("created_at", { ascending: false }).limit(20),
        supabase.from("projects").select("id, name, created_at").eq("user_id", userId!).order("created_at", { ascending: false }).limit(20),
        supabase.from("review_requests").select("id, title, created_at").eq("requester_id", userId!).order("created_at", { ascending: false }).limit(20),
        supabase.from("course_enrollments").select("id, course_id, created_at").eq("student_id", userId!).order("created_at", { ascending: false }).limit(20),
      ]);

      const result: HistoryItem[] = [
        ...(notes.data ?? []).map((item) => ({ id: `note-${item.id}`, label: item.title, detail: "Created a DevNote", createdAt: item.created_at, icon: FileText })),
        ...(snippets.data ?? []).map((item) => ({ id: `snippet-${item.id}`, label: item.title, detail: "Saved a snippet", createdAt: item.created_at, icon: Code2 })),
        ...(projects.data ?? []).map((item) => ({ id: `project-${item.id}`, label: item.name, detail: "Created a project", createdAt: item.created_at, icon: Activity })),
        ...(reviews.data ?? []).map((item) => ({ id: `review-${item.id}`, label: item.title, detail: "Submitted a review request", createdAt: item.created_at, icon: GitPullRequest })),
        ...(enrollments.data ?? []).map((item) => ({ id: `course-${item.id}`, label: `Course ${item.course_id.slice(0, 8)}`, detail: "Joined a course", createdAt: item.created_at, icon: BookOpen })),
      ];

      return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);
    },
  });

  return (
    <AppShell title="My History">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Activity timeline</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Your recent work</h2>
          <p className="mt-2 text-sm text-muted-foreground">A simple record of the notes, code, projects, reviews, and courses you have worked on.</p>
        </div>

        <div className="bento-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your history…</div>
          ) : isError ? (
            <p className="p-8 text-sm text-muted-foreground">History is temporarily unavailable. Please try again.</p>
          ) : items?.length ? (
            <div className="divide-y divide-border/70">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-5 transition-colors hover:bg-muted/20">
                  <div className="mt-0.5 rounded-xl bg-primary/10 p-2.5 text-primary"><item.icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.label}</p><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center"><Activity className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">No activity yet</p><p className="mt-1 text-sm text-muted-foreground">Your work will appear here as you use DevPulse.</p></div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
