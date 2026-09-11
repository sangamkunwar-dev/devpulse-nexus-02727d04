import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, Users, Bug, GitPullRequest, NotebookPen, Code2, FolderKanban, Trash2, Sparkles, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { ensureTodayChallenge } from "@/lib/challenges.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

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
  const ensureChallenge = useServerFn(ensureTodayChallenge);
  const { data: isAdmin, isLoading: checkingRole } = useIsAdmin(userId);
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ["admin-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const [users, challenges, templates, reviews, notes, snippets, projects, attempts] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("challenges").select("*", { count: "exact", head: true }),
        supabase.from("challenge_templates").select("*", { count: "exact", head: true }),
        supabase.from("review_requests").select("*", { count: "exact", head: true }),
        supabase.from("notes").select("*", { count: "exact", head: true }),
        supabase.from("snippets").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("challenge_attempts").select("*", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        challenges: challenges.count ?? 0,
        templates: templates.count ?? 0,
        reviews: reviews.count ?? 0,
        notes: notes.count ?? 0,
        snippets: snippets.count ?? 0,
        projects: projects.count ?? 0,
        attempts: attempts.count ?? 0,
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

  const templates = useQuery({
    queryKey: ["admin-templates"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_templates")
        .select("*")
        .order("last_used_on", { ascending: false, nullsFirst: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const upcoming = useQuery({
    queryKey: ["admin-upcoming-challenges"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("id, challenge_date, title, language, difficulty")
        .order("challenge_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    title: "", language: "javascript", difficulty: "easy", prompt: "",
    broken_code: "", hint: "", xp_reward: 50, answer_pattern: "", explanation: "",
  });
  const [saving, setSaving] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [schedule, setSchedule] = useState({ publish_time: "00:05", timezone: "UTC" });

  const scheduleQuery = useQuery({
    queryKey: ["admin-daily-bug-schedule"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_bug_settings" as never)
        .select("publish_time, timezone")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      const row = data as { publish_time?: string; timezone?: string } | null;
      const next = { publish_time: row?.publish_time?.slice(0, 5) ?? "00:05", timezone: row?.timezone ?? "UTC" };
      setSchedule(next);
      return next;
    },
  });

  const saveSchedule = async () => {
    setScheduleSaving(true);
    const { error } = await supabase
      .from("daily_bug_settings" as never)
      .update({ publish_time: `${schedule.publish_time}:00`, timezone: schedule.timezone, updated_at: new Date().toISOString(), updated_by: userId } as never)
      .eq("id", true);
    setScheduleSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Daily bug schedule saved for ${schedule.publish_time} ${schedule.timezone}.`);
    qc.invalidateQueries({ queryKey: ["admin-daily-bug-schedule"] });
  };

  const addTemplate = async () => {
    if (!form.title || !form.broken_code || !form.answer_pattern) {
      toast.error("Title, broken code and answer pattern are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("challenge_templates").insert(form);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template added to daily bug pool.");
    setForm({ ...form, title: "", prompt: "", broken_code: "", hint: "", answer_pattern: "", explanation: "" });
    qc.invalidateQueries({ queryKey: ["admin-templates"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("challenge_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted.");
    qc.invalidateQueries({ queryKey: ["admin-templates"] });
  };

  const publishToday = async () => {
    try {
      const result = await ensureChallenge();
      if (result.error) {
        toast.error("Could not publish today’s challenge. Check the server logs and Supabase migration.");
        return;
      }
      toast.success(`Today’s ${result.source === "ai" ? "AI-generated" : "template fallback"} bug is published.`);
      qc.invalidateQueries({ queryKey: ["admin-upcoming-challenges"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["challenges"] });
    } catch {
      toast.error("Could not publish today’s challenge. Please try again.");
    }
  };

  if (loading || checkingRole) {
    return <AppShell title="Admin"><Skeleton className="h-96 w-full" /></AppShell>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const cards = [
    { label: "Users", value: stats.data?.users, icon: Users },
    { label: "Challenges", value: stats.data?.challenges, icon: Bug },
    { label: "Templates", value: stats.data?.templates, icon: Sparkles },
    { label: "Reviews", value: stats.data?.reviews, icon: GitPullRequest },
    { label: "Notes", value: stats.data?.notes, icon: NotebookPen },
    { label: "Snippets", value: stats.data?.snippets, icon: Code2 },
    { label: "Projects", value: stats.data?.projects, icon: FolderKanban },
    { label: "Attempts", value: stats.data?.attempts, icon: Shield },
  ];

  return (
    <AppShell title="Admin">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-bold">Control Room</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="bento-card p-4">
              <c.icon className="h-4 w-4 text-muted-foreground" />
              <div className="mt-2 font-display text-2xl font-bold">{c.value ?? "…"}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bento-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Recent challenges</h3>
              <Button size="sm" variant="outline" onClick={publishToday}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Publish today</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">A new AI-generated bug is created daily using the schedule below, with a template fallback if AI is unavailable.</p>
            <div className="mt-3 space-y-1.5">
              {upcoming.data?.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.challenge_date} · {c.language}</div>
                  </div>
                  <Badge variant="accent" className="capitalize">{c.difficulty}</Badge>
                </div>
              ))}
              {!upcoming.data?.length && <div className="text-sm text-muted-foreground">No challenges yet.</div>}
            </div>
          </div>

          <div className="bento-card p-5">
            <h3 className="font-display text-lg font-semibold">Top users</h3>
            <div className="mt-3 space-y-1.5">
              {users.data?.slice(0, 10).map((u) => (
                <div key={u.user_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.display_name ?? u.username}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.is_public && <Badge variant="outline" className="text-[10px]">public</Badge>}
                    <span className="font-mono text-xs">{u.xp} XP</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bento-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Daily bug schedule</h3>
              <p className="mt-1 text-xs text-muted-foreground">AI generation runs when the daily job reaches this time. The page safety net still creates a bug if the job was missed.</p>
            </div>
            <Badge variant="accent">Admin only</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Publish time
              <Input type="time" value={schedule.publish_time} onChange={(e) => setSchedule({ ...schedule, publish_time: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Time zone
              <select className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" value={schedule.timezone} onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}>
                <option value="UTC">UTC</option>
                <option value="Asia/Kathmandu">Asia/Kathmandu</option>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
              </select>
            </label>
            <Button onClick={saveSchedule} disabled={scheduleSaving || scheduleQuery.isLoading}>
              {scheduleSaving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </div>

        <div className="bento-card p-5">
          <h3 className="font-display text-lg font-semibold">Add a bug template</h3>
          <p className="mt-1 text-xs text-muted-foreground">These feed the daily rotation. Answer pattern is a regex matched against the user's (whitespace-stripped, lowercased) submission.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
              <select className="rounded-lg border border-border bg-background px-2 text-sm" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
              </select>
              <Input type="number" placeholder="XP" value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: Number(e.target.value) })} />
            </div>
            <Input className="sm:col-span-2" placeholder="Prompt" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
            <textarea className="sm:col-span-2 min-h-[100px] rounded-lg border border-border bg-background p-2 font-mono text-xs" placeholder="Broken code (use \n for line breaks)" value={form.broken_code} onChange={(e) => setForm({ ...form, broken_code: e.target.value })} />
            <Input placeholder="Hint (optional)" value={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.value })} />
            <Input placeholder="Answer pattern (regex)" value={form.answer_pattern} onChange={(e) => setForm({ ...form, answer_pattern: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Explanation shown after correct answer" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={addTemplate} disabled={saving}><Plus className="mr-1.5 h-4 w-4" />Add template</Button>
          </div>
        </div>

        <div className="bento-card p-5">
          <h3 className="font-display text-lg font-semibold">Template pool ({templates.data?.length ?? 0})</h3>
          <div className="mt-3 space-y-1.5">
            {templates.data?.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.language} · {t.difficulty} · last used {t.last_used_on ?? "never"}</div>
                </div>
                <button onClick={() => deleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
