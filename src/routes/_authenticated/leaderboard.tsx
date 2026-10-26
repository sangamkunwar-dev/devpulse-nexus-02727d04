import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "motion/react";
import { Trophy, Crown, Globe2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/useSession";
import { levelFromXp, levelTitle } from "@/lib/levels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { userId } = useSession();
  const [scope, setScope] = useState<"global" | "region">("global");
  const { data: profile } = useQuery({
    queryKey: ["leaderboard-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("region").eq("user_id", userId!).single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
  });
  const { data: leaders, isLoading } = useQuery({
    queryKey: ["leaderboard", scope, profile?.region],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, xp, role, region, is_public")
        .order("xp", { ascending: false });
      if (scope === "region" && profile?.region) query = query.eq("region", profile.region);
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Leaderboard">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Trophy className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-2 font-display text-2xl font-bold">{scope === "global" ? "Global" : `${profile?.region ?? "Your region"}`} Leaderboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            XP from daily bugs and review contributions. Keep the streak alive.
          </p>
          <div className="mx-auto mt-5 flex w-fit rounded-xl border border-border bg-muted/40 p-1" role="tablist" aria-label="Leaderboard scope">
            <button type="button" role="tab" aria-selected={scope === "global"} onClick={() => setScope("global")} className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors", scope === "global" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}><Globe2 className="h-4 w-4" /> Global</button>
            <button type="button" role="tab" aria-selected={scope === "region"} onClick={() => setScope("region")} className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors", scope === "region" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}><MapPin className="h-4 w-4" /> {profile?.region ?? "Your region"}</button>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          {isLoading && (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          )}
          {leaders?.map((l, i) => {
            const { level } = levelFromXp(l.xp);
            const me = l.user_id === userId;
            return (
              <motion.div
                key={l.username}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className={cn(
                  "bento-card flex items-center gap-4 p-4",
                  me && "border-primary/50",
                  i === 0 && "glow-primary",
                )}
              >
                <span className="w-8 text-center font-mono text-sm text-muted-foreground">
                  {i === 0 ? <Crown className="mx-auto h-5 w-5 text-accent" /> : `#${i + 1}`}
                </span>
                {l.avatar_url ? (
                  <img src={l.avatar_url} alt="" className="h-9 w-9 rounded-full border border-border object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                    {(l.display_name ?? l.username).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {l.display_name ?? l.username} {me && <span className="text-primary">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lv {level} · {levelTitle(level)} · {l.region ?? "Global"}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">{l.role}</Badge>
                <span className="font-mono text-sm font-semibold text-primary">{l.xp} XP</span>
              </motion.div>
            );
          })}
          {!isLoading && (leaders?.length ?? 0) === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No players yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
