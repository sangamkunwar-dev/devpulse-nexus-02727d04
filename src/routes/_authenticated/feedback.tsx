import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MessageSquareHeart, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/feedback")({ component: FeedbackPage });

function FeedbackPage() {
  const { userId } = useSession();
  const [rating, setRating] = useState(5);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject || !trimmedMessage) {
      toast.error("Add a title and tell us what you think.");
      return;
    }
    if (!userId) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = `FB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { error } = await (supabase.from("support_tickets" as never) as any).insert({
        user_id: userId,
        token,
        subject: `[Feedback] ${trimmedSubject}`,
        message: `Rating: ${rating}/5\n\n${trimmedMessage}`,
        status: "open",
      });

      if (error) {
        toast.error("Feedback could not be sent. Please try again.");
      } else {
        setSubmitted(true);
        setSubject("");
        setMessage("");
        toast.success("Thanks for helping improve DevPulse.");
      }
    } catch {
      toast.error("Feedback could not be sent. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Feedback">
      <main className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-primary/10 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <MessageSquareHeart className="size-6" />
              </span>
              <div>
                <Badge variant="outline" className="border-primary/30 text-primary">Your voice matters</Badge>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Help shape DevPulse</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Share an idea, report a rough edge, or tell us what is working well. Your feedback is sent to the admin team for review.</p>
              </div>
            </div>
            <div className="hidden rounded-2xl border border-border/70 bg-background/70 px-5 py-4 text-sm sm:block">
              <p className="text-muted-foreground">Response channel</p>
              <p className="mt-1 font-semibold">DevPulse admin inbox</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Send feedback</CardTitle>
              <CardDescription>Be specific so the team can turn your note into action.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium">How would you rate your experience?</legend>
                <div className="flex flex-wrap gap-2" aria-label="Rating from 1 to 5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" aria-label={`${value} out of 5`} aria-pressed={rating === value} onClick={() => setRating(value)} className={`flex size-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${rating === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="feedback-subject">Title<Input id="feedback-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What should we know?" /></label>
              <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="feedback-message">Your feedback<Textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us about your idea or experience..." className="min-h-36 resize-y" /></label>
              <Button onClick={submitFeedback} disabled={isSubmitting || !subject.trim() || !message.trim()}>
                <Send data-icon="inline-start" />
                {isSubmitting ? "Sending feedback..." : "Send to admin"}
              </Button>
              {submitted && <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /><p><span className="font-semibold">Feedback sent.</span><br /><span className="text-muted-foreground">The admin team can now review it in the support inbox.</span></p></div>}
            </CardContent>
          </Card>

          <Card className="h-fit bg-muted/30">
            <CardHeader><CardTitle>What happens next?</CardTitle><CardDescription>Your note is handled like a support request.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">01</span> Your feedback is securely submitted to the existing DevPulse support inbox.</p>
              <p><span className="font-semibold text-foreground">02</span> Admins see the rating, title, message, and your profile.</p>
              <p><span className="font-semibold text-foreground">03</span> The team can follow up or mark the request as resolved.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppShell>
  );
}

export default FeedbackPage;
