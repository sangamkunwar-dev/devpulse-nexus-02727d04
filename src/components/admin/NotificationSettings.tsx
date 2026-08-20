import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Send, BellRing, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { sendTestNotification } from "@/lib/notifications.functions";

type Recipient = { id: string; email: string; enabled: boolean; created_at: string };

export function NotificationSettings() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const runTest = useServerFn(sendTestNotification);

  const recipients = useQuery({
    queryKey: ["notification-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_recipients")
        .select("id, email, enabled, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Recipient[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["notification-recipients"] });

  const add = async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("notification_recipients").insert({ email: value });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That address is already on the list." : error.message);
      return;
    }
    setEmail("");
    toast.success("Recipient added.");
    refresh();
  };

  const toggle = async (r: Recipient) => {
    const { error } = await supabase
      .from("notification_recipients")
      .update({ enabled: !r.enabled })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(r.enabled ? "Notifications paused for that address." : "Notifications resumed.");
    refresh();
  };

  const remove = async (r: Recipient) => {
    if (!confirm(`Remove ${r.email} from notifications?`)) return;
    const { error } = await supabase.from("notification_recipients").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Recipient removed.");
    refresh();
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await runTest({ data: undefined });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch {
      toast.error("Test failed — you must be signed in as an admin.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bento-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold">Notification recipients</h3>
        </div>
        <Button size="sm" variant="outline" onClick={test} disabled={testing}>
          <Send className="mr-1.5 h-3.5 w-3.5" />{testing ? "Sending…" : "Send test email"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        These addresses receive an email when a new Daily Bug is published and when someone submits a correct answer.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          placeholder="admin@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <Button onClick={add} disabled={busy}><Plus className="mr-1.5 h-4 w-4" />Add</Button>
      </div>

      <div className="mt-3 space-y-1.5">
        {recipients.isLoading && <Skeleton className="h-10 w-full" />}
        {recipients.data?.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-mono text-xs">{r.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.enabled ? "accent" : "outline"} className="text-[10px]">
                {r.enabled ? "active" : "paused"}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => toggle(r)} aria-label="Toggle notifications">
                {r.enabled ? <BellOff className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label="Remove recipient">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {!recipients.isLoading && !recipients.data?.length && (
          <div className="text-sm text-muted-foreground">No recipients yet — notifications are paused.</div>
        )}
      </div>
    </div>
  );
}
