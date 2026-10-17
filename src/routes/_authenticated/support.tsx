import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, Plus, Ticket, CircleDot, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/support")({ component: SupportPage });

type TicketStatus = "open" | "in_progress" | "resolved";
type TicketItem = {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
};
type TicketTable = { insert: (values: Record<string, unknown>) => Promise<{ error: unknown }> };

const statusLabel: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Closed",
};

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant={status === "resolved" ? "secondary" : "outline"} className="gap-1.5">
      <span
        className={`size-1.5 rounded-full ${status === "resolved" ? "bg-muted-foreground" : status === "in_progress" ? "bg-primary" : "bg-foreground"}`}
      />
      {statusLabel[status]}
    </Badge>
  );
}

function SupportPage() {
  const { userId } = useSession();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tickets = useQuery({
    queryKey: ["support-tickets", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as never)
        .select("id, subject, message, status, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TicketItem[];
    },
  });

  const visibleTickets = useMemo(
    () => (tickets.data ?? []).filter((ticket) => filter === "all" || ticket.status === filter),
    [tickets.data, filter],
  );
  const openCount = (tickets.data ?? []).filter((ticket) => ticket.status !== "resolved").length;

  const createTicket = async () => {
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (!cleanSubject || !cleanMessage)
      return toast.error("Add a subject and message before creating a ticket.");
    if (!userId) return toast.error("Your session has expired. Please sign in again.");
    setIsSubmitting(true);
    const { error } = await (
      supabase.from("support_tickets" as never) as unknown as TicketTable
    ).insert({
      user_id: userId,
      subject: cleanSubject,
      message: cleanMessage,
      status: "open",
    });
    if (error) toast.error("Ticket could not be created. Please try again.");
    else {
      setSubject("");
      setMessage("");
      toast.success("Ticket opened. The admin team has been notified.");
      await tickets.refetch();
    }
    setIsSubmitting(false);
  };

  return (
    <AppShell title="Support">
      <main className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-primary/20 bg-primary/10 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <LifeBuoy className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  DevPulse Support
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold">How can we help?</h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Open an issue, track its status, and keep the conversation in one place.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Open issues</span>
              <p className="font-display text-2xl font-bold">{openCount}</p>
            </div>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Open a new issue</CardTitle>
              <CardDescription>
                Describe the problem clearly so the admin team can help.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="support-subject">
                Title
                <Input
                  id="support-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="A short, specific title"
                  maxLength={120}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="support-message">
                Description
                <Textarea
                  id="support-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened? What did you expect?"
                  className="min-h-36 resize-y"
                  maxLength={5000}
                />
              </label>
              <Button
                onClick={createTicket}
                disabled={isSubmitting || !subject.trim() || !message.trim()}
              >
                <Plus data-icon="inline-start" />
                {isSubmitting ? "Opening issue..." : "Open issue"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Your issues</CardTitle>
                  <CardDescription>
                    GitHub-style tracking for every request you send.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-40">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={filter === "all" ? "" : statusLabel[filter]}
                    onChange={() => undefined}
                    readOnly
                    aria-label="Issue filter"
                    className="pl-8"
                    placeholder="Filter status"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant={filter === "all" ? "secondary" : "ghost"}
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                {(["open", "in_progress", "resolved"] as TicketStatus[]).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={filter === status ? "secondary" : "ghost"}
                    onClick={() => setFilter(status)}
                  >
                    {statusLabel[status]}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {tickets.isError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Issues could not be loaded. Please refresh and try again.
                </p>
              )}
              {!tickets.isLoading && !tickets.isError && !visibleTickets.length && (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <Ticket className="mx-auto size-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No issues here</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open a ticket and the admin team will see it immediately.
                  </p>
                </div>
              )}
              {visibleTickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-xl border border-border/70 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">
                        #{ticket.id.slice(0, 8)} · opened{" "}
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                      <h3 className="mt-1 font-medium">{ticket.subject}</h3>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {ticket.message}
                  </p>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleDot className="size-3" /> Status changes from the support team appear here
          automatically.
        </p>
      </main>
    </AppShell>
  );
}

export default SupportPage;
