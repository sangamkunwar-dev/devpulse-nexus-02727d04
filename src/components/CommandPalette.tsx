import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard,
  NotebookPen,
  Code2,
  GitPullRequest,
  Trophy,
  Settings,
  Home,
  GraduationCap,
  LogOut,
  Link2,
  Search,
  FolderKanban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/useSession";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, userId } = useSession();
  const { data: profile } = useProfile(userId);
  const [snippets, setSnippets] = useState<{ id: string; title: string; language: string }[]>([]);
  const [people, setPeople] = useState<
    { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_following: boolean }[]
  >([]);
  const [personSearch, setPersonSearch] = useState("");
  const [peopleSearchError, setPeopleSearchError] = useState<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open && userId) {
      supabase
        .from("snippets")
        .select("id, title, language")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20)
        .then(({ data }) => setSnippets(data ?? []));
    }
  }, [open, userId]);

  useEffect(() => {
    const term = personSearch.trim();
    if (!open || !userId || term.length < 2) {
      setPeople([]);
      return;
    }
    setPeopleSearchError(null);
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_users", { search_term: term });
      if (error) {
        setPeople([]);
        setPeopleSearchError("Apply the follow-search migration in Supabase to search users.");
        return;
      }
      setPeople((data as typeof people) ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, userId, personSearch]);

  const toggleFollow = async (person: (typeof people)[number]) => {
    if (!userId) return;
    if (person.is_following) {
      await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", person.user_id);
    } else {
      await supabase.from("user_follows").insert({ follower_id: userId, following_id: person.user_id });
    }
    setPeople((current) => current.map((item) => item.user_id === person.user_id ? { ...item, is_following: !item.is_following } : item));
    toast.success(person.is_following ? `Unfollowed ${person.username ?? "user"}` : `Following ${person.username ?? "user"}`);
  };

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  const signOut = async () => {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const copyPortfolio = () => {
    if (!profile) return;
    navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`);
    toast.success("Portfolio link copied");
    setOpen(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl glass shadow-2xl"
      overlayClassName="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Command.Input
          placeholder="Search people by username or email…"
          value={personSearch}
          onValueChange={setPersonSearch}
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="kbd-chip">esc</kbd>
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item]]:flex [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-2.5 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-2.5 [&_[cmdk-item]]:py-2 [&_[cmdk-item]]:text-sm [&_[cmdk-item][data-selected=true]]:bg-secondary">
        {peopleSearchError && personSearch.trim().length >= 2 ? (
          <p className="px-3 py-4 text-center text-xs text-destructive">{peopleSearchError}</p>
        ) : (
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>
        )}

        {session && personSearch.trim().length >= 2 && people.length > 0 && (
          <Command.Group heading="People to follow">
            {people.map((person) => (
              <Command.Item key={person.user_id} onSelect={() => toggleFollow(person)}>
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {(person.display_name ?? person.username ?? "U").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  <span className="block truncate">{person.display_name ?? person.username}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{person.username ?? "user"}</span>
                </span>
                <span className="text-xs font-medium text-primary">{person.is_following ? "Following" : "Follow"}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Navigate">
          <Command.Item onSelect={() => go("/")}>
            <Home className="h-4 w-4 text-muted-foreground" /> Home
          </Command.Item>
          <Command.Item onSelect={() => go("/learn")}>
            <GraduationCap className="h-4 w-4 text-muted-foreground" /> Learn Hub
          </Command.Item>
          {session && (
            <>
              <Command.Item onSelect={() => go("/dashboard")}>
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" /> Dashboard
              </Command.Item>
              <Command.Item onSelect={() => go("/notes")}>
                <NotebookPen className="h-4 w-4 text-muted-foreground" /> DevNotes
              </Command.Item>
              <Command.Item onSelect={() => go("/snippets")}>
                <Code2 className="h-4 w-4 text-muted-foreground" /> Snippets
              </Command.Item>
              <Command.Item onSelect={() => go("/projects")}>
                <FolderKanban className="h-4 w-4 text-muted-foreground" /> Projects
              </Command.Item>
              <Command.Item onSelect={() => go("/reviews")}>
                <GitPullRequest className="h-4 w-4 text-muted-foreground" /> Review Labs
              </Command.Item>
              <Command.Item onSelect={() => go("/leaderboard")}>
                <Trophy className="h-4 w-4 text-muted-foreground" /> Leaderboard
              </Command.Item>
              <Command.Item onSelect={() => go("/settings")}>
                <Settings className="h-4 w-4 text-muted-foreground" /> Settings
              </Command.Item>
            </>
          )}
        </Command.Group>

        {session && (
          <Command.Group heading="Actions">
            <Command.Item onSelect={copyPortfolio}>
              <Link2 className="h-4 w-4 text-muted-foreground" /> Copy portfolio link
            </Command.Item>
            <Command.Item onSelect={signOut}>
              <LogOut className="h-4 w-4 text-muted-foreground" /> Sign out
            </Command.Item>
          </Command.Group>
        )}

        {session && snippets.length > 0 && (
          <Command.Group heading="Your snippets">
            {snippets.map((s) => (
              <Command.Item key={s.id} onSelect={() => go("/snippets")}>
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{s.title}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{s.language}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
