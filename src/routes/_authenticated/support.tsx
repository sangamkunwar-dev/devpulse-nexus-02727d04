import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock3, LifeBuoy, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/support")({ component: SupportPage });

type TicketItem = { id: string; subject: string; message: string; status: "Pending" | "In progress" | "Resolved"; createdAt: string };

function statusIcon(status: TicketItem["status"]) {
  if (status === "Resolved") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "In progress") return <Clock3 className="h-4 w-4" />;
  return <Ticket className="h-4 w-4" />;
}

function SupportPage() {
  const { userId } = useSession();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const remoteTickets = useQuery({
    queryKey: ["support-tickets", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_tickets" as never).select("id, ticket_number, subject, message, status, created_at").eq("user_id", userId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`support-tickets-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${userId}` }, () => {
        void remoteTickets.refetch();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, remoteTickets.refetch]);

  const displayTickets: TicketItem[] = (remoteTickets.data ?? []).map((ticket) => ({ id: ticket.ticket_number, subject: ticket.subject, message: ticket.message, status: ticket.status === "resolved" ? "Resolved" : ticket.status === "in_progress" ? "In progress" : "Pending", createdAt: new Date(ticket.created_at).toLocaleDateString() }));
  const openCount = useMemo(() => displayTickets.filter((ticket) => ticket.status !== "Resolved").length, [displayTickets]);

  const createTicket = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject || !trimmedMessage) {
      toast.error("Add a subject and message before creating a ticket.");
      return;
    }

    if (!userId) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = `DP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { error } = await (supabase.from("support_tickets" as never) as any).insert({
        user_id: userId,
        ticket_number: token,
        subject: trimmedSubject,
        message: trimmedMessage,
        status: "pending",
      });

      if (error) {
        console.error("[v0] Support ticket creation failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const reason = error.code === "42P01"
          ? "The support_tickets table has not been created yet."
          : error.code === "42501"
            ? "Supabase blocked this request. Check the support_tickets RLS policies."
            : error.message || "Supabase rejected the ticket.";
        toast.error(`Ticket could not be created: ${reason}`);
        return;
      }

      setSubmitted(token);
      setSubject("");
      setMessage("");
      toast.success("Support ticket created.");
      await remoteTickets.refetch();
    } catch (error) {
      console.error("[v0] Unexpected support ticket error:", error);
      toast.error("Ticket could not be created. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Support">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-primary/20 bg-primary/10 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><LifeBuoy className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">DevPulse Support</p><h2 className="mt-1 font-display text-2xl font-bold">How can we help?</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Send a message and we&apos;ll create a support ticket with a tracking token for you.</p></div></div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm"><span className="text-muted-foreground">Open tickets</span><p className="font-display text-2xl font-bold">{openCount}</p></div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card>
            <CardHeader><CardTitle>Send a message</CardTitle><CardDescription>Include enough detail for our team to investigate quickly.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="support-subject">Subject<Input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" /></label>
              <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="support-message">Message<Textarea id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what happened..." className="min-h-32 resize-y" /></label>
              <Button onClick={createTicket} disabled={isSubmitting || !subject.trim() || !message.trim()}>
                <Plus data-icon="inline-start" />
                {isSubmitting ? "Creating ticket..." : "Create support ticket"}
              </Button>
              {submitted && <div className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm"><p className="font-medium text-primary">Ticket created successfully</p><p className="mt-1 text-muted-foreground">Your tracking token is <strong className="font-mono text-foreground">{submitted}</strong>. Keep it for follow-up.</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Your tickets</CardTitle><CardDescription>Track pending, active, and resolved requests.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {displayTickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-border/70 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-primary">{ticket.id} · {ticket.createdAt}</p><h3 className="mt-1 truncate font-medium">{ticket.subject}</h3></div><Badge variant={ticket.status === "Resolved" ? "secondary" : "outline"} className="shrink-0 gap-1">{statusIcon(ticket.status)}{ticket.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{ticket.message}</p></article>)}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">Ticket updates from the support team appear here automatically.</p>
      </div>
    </AppShell>
  );
}
