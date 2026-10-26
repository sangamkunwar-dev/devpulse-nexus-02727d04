import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Plus, Trash2, Globe, Lock, X, ExternalLink, Github, FolderKanban, RefreshCw, GitFork } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [repositories, setRepositories] = useState<Array<{ name: string; html_url: string; description: string | null }>>([]);
  const [showRepositories, setShowRepositories] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    url: "",
    repo_url: "",
    tags: "",
    is_public: true,
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["projects", userId] });

  const syncRepositories = async () => {
    setSyncing(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.provider_token;
    if (!token) {
      toast.error("Reconnect with GitHub to grant repository access.");
      setSyncing(false);
      return;
    }
    const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      toast.error("GitHub did not return your repositories.");
      setSyncing(false);
      return;
    }
    setRepositories(await response.json());
    setShowRepositories(true);
    setSyncing(false);
  };

  const selectRepository = (repository: { name: string; html_url: string; description: string | null }) => {
    setForm((current) => ({
      ...current,
      title: current.title || repository.name,
      description: current.description || repository.description || "",
      repo_url: repository.html_url,
    }));
    setShowForm(true);
    setShowRepositories(false);
    toast.success("Repository connected to the project form");
  };

  const createRepository = async () => {
    const name = window.prompt("New GitHub repository name");
    if (!name?.trim()) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.provider_token;
    if (!token) {
      toast.error("Reconnect with GitHub to create repositories.");
      return;
    }
    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), private: false }),
    });
    if (!response.ok) {
      toast.error("GitHub could not create that repository.");
      return;
    }
    selectRepository(await response.json());
    toast.success("Repository created and connected");
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Give your project a title.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      user_id: userId!,
      title: form.title.trim().slice(0, 200),
      description: form.description.trim() || null,
      url: form.url.trim() || null,
      repo_url: form.repo_url.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
      is_public: form.is_public,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save project.");
      return;
    }
    toast.success("Project saved");
    setForm({ title: "", description: "", url: "", repo_url: "", tags: "", is_public: true });
    setShowForm(false);
    refresh();
  };

  const togglePublic = async (id: string, current: boolean) => {
    const { error } = await supabase.from("projects").update({ is_public: !current }).eq("id", id);
    if (!error) {
      toast.success(!current ? "Project is now on your portfolio" : "Project is private");
      refresh();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (!error) {
      toast.success("Project deleted");
      refresh();
    }
  };

  return (
    <AppShell title="Projects">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Ship-worthy work. Public projects show on your <span className="text-foreground">bento portfolio</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={syncRepositories} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync GitHub
            </Button>
            <Button variant="outline" onClick={createRepository}>
              <GitFork className="mr-2 h-4 w-4" /> New repository
            </Button>
            <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Add project"}
            </Button>
          </div>
        </div>

        {showRepositories && (
          <div className="bento-card mt-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold">Your GitHub repositories</p>
                <p className="text-xs text-muted-foreground">Choose one to connect it to a DevPulse project.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowRepositories(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {repositories.map((repository) => (
                <button key={repository.html_url} type="button" onClick={() => selectRepository(repository)} className="rounded-lg border p-3 text-left hover:border-primary">
                  <span className="flex items-center gap-2 font-medium"><Github className="h-4 w-4" />{repository.name}</span>
                  <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{repository.description || "No description"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bento-card mt-4 space-y-3 p-5">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="DevPulse — study workspace" maxLength={200} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    className="min-h-24"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What does it do? What did you learn building it?"
                    maxLength={1000}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Live URL (optional)</Label>
                    <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
                  </div>
                  <div>
                    <Label>GitHub repository URL (optional)</Label>
                    <Input
                      value={form.repo_url}
                      onChange={(e) => setForm({ ...form, repo_url: e.target.value })}
                      placeholder="https://github.com/username/repository"
                      type="url"
                      inputMode="url"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Link the source repository so visitors can open the project code.
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Tags (comma separated)</Label>
                  <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="react, supabase, tailwind" />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setForm({ ...form, is_public: !form.is_public })}
                    type="button"
                  >
                    {form.is_public ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
                    {form.is_public ? "Public — shows on portfolio" : "Private"}
                  </button>
                  <Button onClick={save} disabled={saving}>Save project</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {isLoading && (
            <>
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </>
          )}
          {!isLoading && (projects ?? []).length === 0 && (
            <div className="bento-card col-span-full flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
              <FolderKanban className="h-8 w-8 text-primary/70" />
              <p>No projects yet. Add your first one and it'll show up on your bento portfolio.</p>
            </div>
          )}
          {(projects ?? []).map((p) => (
            <motion.div key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bento-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold">{p.title}</p>
                  {p.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
                  )}
                </div>
                <Badge variant={p.is_public ? "default" : "secondary"}>
                  {p.is_public ? "Public" : "Private"}
                </Badge>
              </div>

              {p.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t: string) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-3.5 w-3.5" /> Live
                    </a>
                  )}
                  {p.repo_url && (
                    <a href={p.repo_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-primary">
                      <Github className="h-3.5 w-3.5" /> Repo
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title={p.is_public ? "Make private" : "Publish to portfolio"}
                    onClick={() => togglePublic(p.id, p.is_public)}
                  >
                    {p.is_public ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
