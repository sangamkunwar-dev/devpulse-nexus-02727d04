import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, History as HistoryIcon, Flame, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "My Daily Bug History — DevPulse" },
      { name: "description", content: "Track every Daily Bug attempt you made, whether it was correct, and when you submitted it." },
      { property: "og:title", content: "My Daily Bug History — DevPulse" },
      { property: "og:description", content: "Your day-by-day debugging progress on DevPulse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

type Row = {
  id: string;
  answer: string;
  is_correct: boolean;
  created_at: string;
  challenge_id: string;
};

function HistoryPage() {
  const { userId } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["challenge-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: attempts, error } = await supabase
        .from("challenge_attempts")
        .select("id, answer, is_correct, created_at, challenge_id")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (attempts ?? []) as Row[];
      const ids = [...new Set(rows.map((r) => r.challenge_id))];
      const { data: challenges } = ids.length
        ? await supabase.from("challenges").select("id, title, language, difficulty, challenge_date, xp_reward").in("id", ids)
        : { data: [] as never[] };
      const map = new Map((challenges ?? []).map((c) => [c.id, c]));
      return { rows, map };
    },
  });

  const rows = data?.rows ?? [];
  const solvedIds = new Set(rows.filter((r) => r.is_correct).map((r) => r.challenge_id));
  const accuracy = rows.length ? Math.round((rows.filter((r) => r.is_correct).length / rows.length) * 100) : 0;

  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }

  const stats = [
    { label: "Attempts", value: rows.length, icon: Target },
    { label: "Bugs squashed", value: solvedIds.size, icon: CheckCircle2 },
    { label: "Accuracy", value: `${accuracy}%`, icon: Flame },
    { label: "Active days", value: byDay.size, icon: HistoryIcon },
  ];

  return (
    <AppShell title="My Challenge History">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bento-card p-4">
              <s.icon className="h-4 w-4 text-muted-foreground" />
              <div className="mt-2 font-display text-2xl font-bold">{isLoading ? "…" : s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {isLoading && <Skeleton className="h-72 w-full" />}

        {!isLoading && rows.length === 0 && (
          <div className="bento-card p-10 text-center text-muted-foreground">
            No attempts yet.{" "}
            <Link to="/challenges" className="text-primary underline-offset-4 hover:underline">
              Try today's Daily Bug
            </Link>
            .
          </div>
        )}

        {[...byDay.entries()].map(([day, dayRows]) => (
          <div key={day} className="bento-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{day}</h3>
              <span className="text-xs text-muted-foreground">{dayRows.length} attempt{dayRows.length > 1 ? "s" : ""}</span>
            </div>
            <div className="mt-3 space-y-2">
              {dayRows.map((r) => {
                const c = data?.map.get(r.challenge_id);
                return (
                  <div key={r.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {r.is_correct ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <span className="truncate text-sm font-medium">{c?.title ?? "Challenge"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c && <Badge variant="secondary">{c.language}</Badge>}
                        {c && <Badge variant="accent" className="capitalize">{c.difficulty}</Badge>}
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] text-muted-foreground">
                      {r.answer}
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
