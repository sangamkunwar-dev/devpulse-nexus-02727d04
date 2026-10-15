import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, LifeBuoy, Plus, ShieldCheck, Ticket, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/support")({ component: SupportPage });

type TicketItem = { id: string; subject: string; message: string; status: "Pending" | "In progress" | "Resolved"; createdAt: string };

const seedTickets: TicketItem[] = [
  { id: "DP-4821", subject: "Course progress is not updating", message: "My completed lesson is still showing as incomplete.", status: "Pending", createdAt: "Today" },
  { id: "DP-4710", subject: "Unable to upload a snippet", message: "The upload button returns me to the snippets page.", status: "Resolved", createdAt: "Oct 8" },
];

function statusIcon(status: TicketItem["status"]) {
  if (status === "Resolved") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "In progress") return <Clock3 className="h-4 w-4" />;
  return <Ticket className="h-4 w-4" />;
}

function SupportPage() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const [tickets, setTickets] = useState(seedTickets);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const isAdmin = profile?.role === "admin";
  const openCount = useMemo(() => tickets.filter((ticket) => ticket.status !== "Resolved").length, [tickets]);

  const createTicket = () => {
    if (!subject.trim() || !message.trim()) return;
    const id = `DP-${Math.floor(1000 + Math.random() * 9000)}`;
    setTickets((current) => [{ id, subject: subject.trim(), message: message.trim(), status: "Pending", createdAt: "Just now" }, ...current]);
    setSubmitted(id);
    setSubject("");
    setMessage("");
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
              <Button onClick={createTicket} disabled={!subject.trim() || !message.trim()}><Plus data-icon="inline-start" />Create support ticket</Button>
              {submitted && <div className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm"><p className="font-medium text-primary">Ticket created successfully</p><p className="mt-1 text-muted-foreground">Your tracking token is <strong className="font-mono text-foreground">{submitted}</strong>. Keep it for follow-up.</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Your tickets</CardTitle><CardDescription>Track pending, active, and resolved requests.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {tickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-border/70 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-primary">{ticket.id} · {ticket.createdAt}</p><h3 className="mt-1 truncate font-medium">{ticket.subject}</h3></div><Badge variant={ticket.status === "Resolved" ? "secondary" : "outline"} className="shrink-0 gap-1">{statusIcon(ticket.status)}{ticket.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{ticket.message}</p></article>)}
            </CardContent>
          </Card>
        </div>

        {isAdmin && <Card className="border-primary/20"><CardHeader><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><div><CardTitle>Admin support queue</CardTitle><CardDescription>Review submitted ticket details and update their status.</CardDescription></div></div></CardHeader><CardContent className="flex flex-col gap-3">{tickets.map((ticket) => <div key={ticket.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-xs text-primary">{ticket.id}</p><p className="mt-1 font-medium">{ticket.subject}</p><p className="mt-1 text-sm text-muted-foreground">{ticket.message}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status: "In progress" } : item))}><Clock3 data-icon="inline-start" />In progress</Button><Button size="sm" variant="secondary" onClick={() => setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status: "Resolved" } : item))}><CheckCircle2 data-icon="inline-start" />Resolve</Button></div></div>)}</CardContent></Card>}

        <p className="flex items-center gap-2 text-xs text-muted-foreground"><XCircle className="h-3.5 w-3.5" />This preview stores tickets in the current session. Connect Supabase later to share tickets between users and admins.</p>
      </div>
    </AppShell>
  );
}
