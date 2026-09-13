import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  NotebookPen,
  Code2,
  GitPullRequest,
  Trophy,
  ArrowRight,
  LayoutGrid,
  Flame,
  Search,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession, useProfile } from "@/hooks/useSession";
import { levelFromXp, levelTitle } from "@/lib/levels";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { userId } = useSession();
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [people, setPeople] = useState<Array<{ user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_following: boolean; follows_you: boolean }>>([]);
  const [peopleError, setPeopleError] = useState<string | null>(null);

  useEffect(() => {
    const term = peopleSearch.trim();
    if (!userId || term.length < 2) {
      setPeople([]);
      setPeopleError(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_users", { search_term: term });
      if (error) {
        setPeople([]);
        setPeopleError("User search is unavailable until the follow-search SQL is applied.");
        return;
      }
      setPeopleError(null);
      setPeople((data as typeof people) ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [peopleSearch, userId]);

  useEffect(() => {
    if (profile && !profile.onboarded) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [profile, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [notes, snippets, reviews, leaders] = await Promise.all([
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("is_deleted", false),
        supabase.from("snippets").select("id", { count: "exact", head: true }).eq("user_id", userId!),
        supabase.from("review_requests").select("id, title, language, status, created_at").order("created_at", { ascending: false }).limit(4),
        supabase.from("profiles").select("username, display_name, xp").order("xp", { ascending: false }).limit(5),
      ]);
      return {
        notesCount: notes.count ?? 0,
        snippetsCount: snippets.count ?? 0,
        reviews: reviews.data ?? [],
        leaders: leaders.data ?? [],
      };
    },
  });

  const toggleFollow = async (person: (typeof people)[number]) => {
    if (!userId) return;
    const { error } = person.is_following
      ? await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", person.user_id)
      : await supabase.from("user_follows").insert({ follower_id: userId, following_id: person.user_id });
    if (error) {
      setPeopleError("Could not update follow status. Please try again.");
      return;
    }
    setPeople((current) => current.map((item) => item.user_id === person.user_id ? { ...item, is_following: !item.is_following } : item));
  };

  const xp = profile?.xp ?? 0;
  const { level, progress, toNext } = levelFromXp(xp);
  const firstName = (profile?.display_name ?? profile?.username ?? "dev").split(" ")[0];

  return (
    <AppShell title="Dashboard">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold">
            {profileLoading ? "…" : `Hey ${firstName} 👋`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.role === "student"
              ? "Ready to learn something new today?"
              : "Let's ship something great today."}
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bento-card mt-6 p-5"
          aria-labelledby="find-people-heading"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="find-people-heading" className="font-display text-lg font-semibold">Find people</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search by name, username, or email and follow developers.</p>
            </div>
            <Search className="hidden h-5 w-5 text-primary sm:block" />
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={peopleSearch}
              onChange={(event) => setPeopleSearch(event.target.value)}
              placeholder="Search people…"
              aria-label="Search people"
              className="h-10 w-full rounded-lg border border-input bg-muted/50 pl-9 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          {peopleError && <p className="mt-3 text-sm text-destructive">{peopleError}</p>}
          {peopleSearch.trim().length >= 2 && !peopleError && (
            <div className="mt-3 space-y-2">
              {people.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">No people found.</p>
              ) : people.map((person) => (
                <div key={person.user_id} className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {(person.display_name ?? person.username ?? "U").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <Link to="/u/$username" params={{ username: person.username ?? "" }} className="min-w-0 flex-1 hover:text-primary">
                    <span className="block truncate text-sm font-medium">{person.display_name ?? person.username}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{person.username ?? "user"}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFollow(person)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-primary/50 hover:text-primary"
                  >
                    {person.is_following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {person.is_following ? "Following" : person.follows_you ? "Follow back" : "Follow"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <div className="mt-6 grid gap-4 md:grid-cols-6">
          {/* XP card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bento-card p-6 md:col-span-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</span>
              <Flame className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-3 font-display text-4xl font-bold text-primary">Lv {level}</p>
            <p className="text-sm text-muted-foreground">{levelTitle(level)}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, progress * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {xp} XP · {toNext} to next level
            </p>
          </motion.div>

          {/* Counts */}
          {[
            { icon: NotebookPen, label: "DevNotes", value: stats?.notesCount, to: "/notes" },
            { icon: Code2, label: "Snippets", value: stats?.snippetsCount, to: "/snippets" },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bento-card p-6 md:col-span-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              {c.value === undefined ? (
                <Skeleton className="mt-3 h-9 w-14" />
              ) : (
                <p className="mt-3 font-display text-4xl font-bold">{c.value}</p>
              )}
              <Link to={c.to} className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          ))}

          {/* Portfolio */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bento-card p-6 md:col-span-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio</span>
              <LayoutGrid className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-sm">
              {profile?.is_public ? (
                <span className="text-primary">● Live & public</span>
              ) : (
                <span className="text-muted-foreground">○ Private</span>
              )}
            </p>
            {profile?.is_public ? (
              <a
                href={`/u/${profile.username}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View live <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Link to="/settings" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Go public <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </motion.div>

          {/* Recent reviews */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bento-card p-6 md:col-span-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review Labs</span>
              <GitPullRequest className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 space-y-2">
              {stats ? (
                stats.reviews.length > 0 ? (
                  stats.reviews.map((r) => (
                    <Link
                      key={r.id}
                      to="/reviews/$id"
                      params={{ id: r.id }}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:border-primary/40"
                    >
                      <span className="truncate">{r.title}</span>
                      <Badge variant={r.status === "open" ? "default" : "outline"}>{r.status}</Badge>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No submissions yet — <Link to="/reviews" className="text-primary hover:underline">be the first</Link>.
                  </p>
                )
              ) : (
                <>
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </>
              )}
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bento-card p-6 md:col-span-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top hackers</span>
              <Trophy className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-3 space-y-2">
              {stats ? (
                stats.leaders.map((l, i) => (
                  <div key={l.username} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-mono text-xs text-muted-foreground">#{i + 1}</span>
                    <span className="flex-1 truncate">{l.display_name ?? l.username}</span>
                    <span className="font-mono text-xs text-primary">{l.xp} XP</span>
                  </div>
                ))
              ) : (
                <>
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </>
              )}
              <Link to="/leaderboard" className="inline-flex items-center gap-1 pt-1 text-sm text-primary hover:underline">
                Full leaderboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
