import { useEffect, useState } from "react";
import { MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
};

export function SupportFeedbackWidget({ userId, isAdmin }: { userId: string | null; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"support" | "feedback">("support");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sending, setSending] = useState(false);

  const loadTickets = async () => {
    if (!isAdmin) return;
    const { data } = await supabase
      .from("support_tickets" as never)
      .select("id, subject, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    setTickets((data ?? []) as unknown as Ticket[]);
  };

  useEffect(() => {
    if (open) void loadTickets();
  }, [open, isAdmin]);

  const submit = async () => {
    const trimmed = message.trim();
    if (!userId || !trimmed) return;
    setSending(true);
    const { error } = await (supabase.from("support_tickets" as never) as never).insert({
      user_id: userId,
      subject: kind === "feedback" ? "Product feedback" : "Support request",
      message: trimmed,
    });
    setSending(false);
    if (error) {
      toast.error("Your message could not be sent. Please try again.");
      return;
    }
    setMessage("");
    toast.success(kind === "feedback" ? "Thanks for the feedback." : "Support request sent.");
    if (isAdmin) void loadTickets();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/15">
          <div className="flex items-start justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" /> DevPulse support</p>
              <p className="mt-0.5 text-xs text-primary-foreground/75">We read every message.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close support chat" className="rounded-md p-1 hover:bg-primary-foreground/15"><X className="h-4 w-4" /></button>
          </div>
          {isAdmin && (
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Recent inbox</p>
              <div className="max-h-28 space-y-2 overflow-y-auto">
                {tickets.length ? tickets.map((ticket) => <div key={ticket.id} className="rounded-lg border border-border bg-background p-2 text-xs"><div className="flex justify-between gap-2"><span className="font-medium">{ticket.subject}</span><span className="text-muted-foreground">{ticket.status.replace("_", " ")}</span></div><p className="mt-1 line-clamp-2 text-muted-foreground">{ticket.message}</p></div>) : <p className="text-xs text-muted-foreground">No messages yet.</p>}
              </div>
            </div>
          )}
          <div className="p-4">
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["support", "feedback"] as const).map((value) => <button key={value} type="button" onClick={() => setKind(value)} className={cn("rounded-md px-2 py-1.5 text-xs font-medium capitalize transition", kind === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>{value}</button>)}
            </div>
            <label htmlFor="support-message" className="sr-only">Your message</label>
            <textarea id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={kind === "feedback" ? "What should we improve?" : "How can we help?"} rows={4} className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
            <button type="button" disabled={sending || !message.trim()} onClick={() => void submit()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" />{sending ? "Sending…" : "Send message"}</button>
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close support" : "Open support and feedback"} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:scale-105 hover:bg-primary/90"><MessageCircle className="h-5 w-5" /></button>
    </div>
  );
}
