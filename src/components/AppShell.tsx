import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  NotebookPen,
  Code2,
  GitPullRequest,
  Trophy,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Command,
  FolderKanban,
  Shield,
  History,
  ScrollText,
  GraduationCap,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/useSession";
import { levelFromXp } from "@/lib/levels";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "Courses", icon: GraduationCap },
  { to: "/notes", label: "DevNotes", icon: NotebookPen },
  { to: "/snippets", label: "Snippets", icon: Code2 },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/reviews", label: "Review Labs", icon: GitPullRequest },
  { to: "/history", label: "My History", icon: History },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const ADMIN_ITEMS = [
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: userId!, _role: "admin" });
      return !!data;
    },
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, href, read_at, created_at")
        .eq("recipient_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const notifications = notificationsQuery.data ?? [];
  const unreadNotificationCount = notifications.filter((notification) => !notification.read_at).length;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const notificationInitialized = useRef(false);

  const markNotificationRead = async (id: string, href?: string | null) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    if (href) navigate({ to: href as never });
  };

  const emailNotification = async (id: string) => {
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/notifications/email", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error ?? result?.reason ?? "Email could not be sent");
    }
  };

  useEffect(() => {
    if (!userId || !notifications.length) return;
    const unseen = notificationInitialized.current ? notifications.filter((notification) => !seenNotificationIds.current.has(notification.id)) : [];
    for (const notification of notifications) seenNotificationIds.current.add(notification.id);
    notificationInitialized.current = true;
    if (seenNotificationIds.current.size > notifications.length + 20) {
      seenNotificationIds.current = new Set(notifications.map((notification) => notification.id));
    }
    if (unseen.length) {
      for (const notification of unseen) {
        void emailNotification(notification.id).catch((error) => {
          console.error("[v0] Automatic notification email failed", error);
          toast.error("Notification email could not be sent. Check your Resend sender domain.");
        });
      }
    }
  }, [notifications, userId]);

  const teacherItems = ["teacher", "developer"].includes(
    (profile as { role?: string } | undefined)?.role ?? "",
  )
    ? [{ to: "/teacher", label: "Teacher Studio", icon: GraduationCap }]
    : [];
  const nav = isAdmin
    ? [...NAV, ...teacherItems, ...ADMIN_ITEMS, { to: "/settings", label: "Settings", icon: Settings }]
    : [...NAV, ...teacherItems, { to: "/settings", label: "Settings", icon: Settings }];
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { level, progress } = levelFromXp(profile?.xp ?? 0);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-2 px-5 py-5">
        <img src="/devpulse-logo.png" alt="DevPulse" className="h-7 w-7 rounded-lg object-cover" />
        <span className="font-display text-lg font-semibold tracking-tight">DevPulse</span>
      </Link>

      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-4 w-4", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {profile?.is_public && (
          <a
            href={`/u/${profile.username}`}
            target="_blank"
            rel="noreferrer"
            className="mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View public portfolio
          </a>
        )}
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-medium">
              {profile?.display_name ?? profile?.username ?? "…"}
            </span>
            <button
              onClick={signOut}
              title="Sign out"
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">Lv {level}</span>
            <span className="font-mono">{profile?.xp ?? 0} XP</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar animate-slide-in-right [animation-direction:reverse]">
            <button
              className="absolute right-3 top-4 text-muted-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex min-w-0 h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-8">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-semibold">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={unreadNotificationCount ? `${unreadNotificationCount} unread notifications` : "Notifications"}
                aria-expanded={notificationsOpen}
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div><p className="font-medium">Notifications</p><p className="text-xs text-muted-foreground">Activity from your DevPulse network</p></div>
                    {unreadNotificationCount > 0 && <span className="text-xs text-primary">{unreadNotificationCount} new</span>}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notificationsQuery.isError ? <p className="px-4 py-8 text-center text-sm text-destructive">Notifications could not load. Please refresh and try again.</p> : notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p> : notifications.map((notification) => (
                      <div key={notification.id} className={cn("border-b border-border px-4 py-3 transition hover:bg-muted", !notification.read_at && "bg-primary/5")}><button type="button" onClick={() => void markNotificationRead(notification.id, notification.href)} className="block w-full text-left">
                        <div className="flex items-start gap-2"><span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", notification.read_at ? "bg-muted" : "bg-primary")} /><div className="min-w-0"><p className="text-sm font-medium">{notification.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</p></div></div>
                      </button><button type="button" onClick={() => void emailNotification(notification.id).then(() => toast.success("Notification email sent.")).catch(() => toast.error("Email could not be sent."))} className="mt-2 text-[11px] font-medium text-primary hover:underline">Send to email</button></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
                )
              }
              className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 sm:flex"
            >
              <Command className="h-3 w-3" /> Search & commands
              <kbd className="kbd-chip">⌘K</kbd>
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</main>
        <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground lg:px-8">
          Made by <span className="font-medium text-foreground">Sangam Kunwar</span>
        </footer>
      </div>
    </div>
  );
}
