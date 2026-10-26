import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, Mail, Lock, Loader2, Github, Chrome } from "lucide-react";
import { supabase } from "@/integrations/supabase/client"; // Native Supabase Client
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DevPulse" },
      { name: "description", content: "Sign in or create your free DevPulse account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  // FIX: Using direct supabase client instead of lovable wrapper
  const handleOAuth = async (provider: "github" | "google") => {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          scopes: provider === "github" ? "repo read:user user:email" : undefined,
          redirectTo:
            import.meta.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${provider} sign-in failed.`;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { role, display_name: email.trim().split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg.includes("Invalid login") ? "Wrong email or password." : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-xl font-semibold">DevPulse</span>
        </Link>

        <div className="bento-card p-6">
          <h1 className="text-center font-display text-xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your workspace"
              : "Free forever for students & developers"}
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => handleOAuth("google")} disabled={busy}>
              <Chrome className="mr-2 h-4 w-4" /> Google
            </Button>
            <Button variant="outline" onClick={() => handleOAuth("github")} disabled={busy}>
              <Github className="mr-2 h-4 w-4" /> GitHub
            </Button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or with email{" "}
            <div className="h-px flex-1 bg-border" />
          </div>

          {mode === "signup" && (
            <div className="mt-6">
              <Label>I am signing up as</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`rounded-lg border p-3 text-left transition ${role === "student" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <span className="block font-medium">Student</span>
                  <span className="text-xs text-muted-foreground">Learn and practice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("teacher")}
                  className={`rounded-lg border p-3 text-left transition ${role === "teacher" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <span className="block font-medium">Teacher</span>
                  <span className="text-xs text-muted-foreground">Create free courses</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="email">
                <Mail className="mr-1 inline h-3 w-3" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
              />
            </div>
            <div>
              <Label htmlFor="password">
                <Lock className="mr-1 inline h-3 w-3" /> Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={100}
              />
            </div>
            <Button className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
