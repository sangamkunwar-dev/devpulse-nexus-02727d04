import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock3, MessageCircle, Paperclip, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    userId: typeof search.userId === "string" ? search.userId : "",
    username: typeof search.username === "string" ? search.username : "",
  }),
  component: MessagesPage,
});

type Contact = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Message = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null; attachment_path: string | null; attachment_name: string | null; attachment_type: string | null; attachment_size: number | null };
type Attachment = { pathname: string; name: string; type: string; size: number };

function Avatar({ contact, size = "h-10 w-10" }: { contact?: Contact | null; size?: string }) {
  const label = (contact?.display_name ?? contact?.username ?? "U").slice(0, 1).toUpperCase();
  return contact?.avatar_url ? (
    <img src={contact.avatar_url} alt="" className={`${size} shrink-0 rounded-full border border-border object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary`}>{label}</span>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function MessagesPage() {
  const { userId } = useSession();
  const { userId: selectedId, username: selectedUsername } = Route.useSearch();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["message-contacts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: followRows, error: followError } = await supabase.from("user_follows").select("following_id, follower_id").or(`follower_id.eq.${userId},following_id.eq.${userId}`);
      if (followError) throw followError;
      const { data: messageRows, error: messageError } = await supabase
        .from("direct_messages")
        .select("sender_id, recipient_id")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
      if (messageError) throw messageError;
      const followIds = (followRows ?? []).map((row) => row.follower_id === userId ? row.following_id : row.follower_id);
      const messageIds = (messageRows ?? []).map((row) => row.sender_id === userId ? row.recipient_id : row.sender_id);
      const ids = [...new Set([...followIds, ...messageIds])];
      if (!ids.length) return [] as Contact[];
      const result = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", ids);
      if (result.error) throw result.error;
      return (result.data ?? []) as Contact[];
    },
  });

  const activeContact = useMemo(() => contacts.find((contact) => contact.user_id === selectedId), [contacts, selectedId]);
  const activeName = activeContact?.display_name ?? activeContact?.username ?? selectedUsername ?? "Select a person";

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["direct-messages", userId, selectedId],
    enabled: !!userId && !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase.from("direct_messages").select("id, sender_id, recipient_id, body, created_at, read_at, attachment_path, attachment_name, attachment_type, attachment_size")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${userId})`).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!userId || !selectedId) return;
    const unread = messages.filter((message) => message.recipient_id === userId && !message.read_at).map((message) => message.id);
    if (unread.length) {
      void supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {
        void queryClient.invalidateQueries({ queryKey: ["unread-message-count", userId] });
      });
    }
  }, [messages, queryClient, selectedId, userId]);

  useEffect(() => {
    if (!userId || !selectedId) return;
    const channel = supabase.channel(`messages-${userId}-${selectedId}`).on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => {
      void queryClient.invalidateQueries({ queryKey: ["direct-messages", userId, selectedId] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, selectedId, userId]);

  const uploadAttachment = async (file: File | undefined) => {
    if (!file || !userId) return;
    setUploading(true); setSendError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/messages/upload", { method: "POST", headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ""}` }, body: form });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Attachment upload failed.");
      setAttachment(result as Attachment);
    } catch (error) { setSendError(error instanceof Error ? error.message : "Attachment upload failed."); } finally { setUploading(false); }
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase.from("direct_messages").delete().eq("id", messageId);
    if (error) return setSendError("Only your own messages can be deleted.");
    await queryClient.invalidateQueries({ queryKey: ["direct-messages", userId, selectedId] });
  };

  const sendMessage = async () => {
    const text = body.trim();
    if ((!text && !attachment) || !userId || !selectedId) return;
    setSendError(null);
    const { data: sentMessage, error } = await (supabase as any).from("direct_messages").insert({ sender_id: userId, recipient_id: selectedId, body: text, attachment_path: attachment?.pathname ?? null, attachment_name: attachment?.name ?? null, attachment_type: attachment?.type ?? null, attachment_size: attachment?.size ?? null }).select("id").single();
    if (error) { setSendError("Message could not be sent. Please try again."); return; }
    setBody(""); setAttachment(null);
    if (sentMessage) { void fetch("/api/messages/email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}` }, body: JSON.stringify({ recipientId: selectedId, senderName: activeName, preview: text, messageId: sentMessage.id }) }); }
    await queryClient.invalidateQueries({ queryKey: ["direct-messages", userId, selectedId] });
  };

  return (
    <AppShell title="Messages">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row">
        <section className="bento-card w-full p-3 lg:w-80">
          <div className="mb-3 flex items-center gap-2 border-b border-border px-2 pb-3"><MessageCircle className="h-4 w-4 text-primary" /><div><h2 className="font-display font-semibold">Messages</h2><p className="text-xs text-muted-foreground">Your conversations</p></div></div>
          {contactsLoading ? <p className="px-2 py-4 text-sm text-muted-foreground">Loading contacts…</p> : contacts.length === 0 ? <p className="px-2 py-4 text-sm text-muted-foreground">Follow someone from Dashboard to start a conversation.</p> : <div className="space-y-1">{contacts.map((contact) => <Link key={contact.user_id} to="/messages" search={{ userId: contact.user_id, username: contact.username ?? "" }} className={`flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-muted ${contact.user_id === selectedId ? "bg-primary/10" : ""}`}><Avatar contact={contact} size="h-10 w-10" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{contact.display_name ?? contact.username}</span><span className="block truncate text-xs text-muted-foreground">@{contact.username}</span></span></Link>)}</div>}
        </section>
        <section className="bento-card flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4"><Link to="/dashboard" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to Dashboard"><ArrowLeft className="h-4 w-4" /></Link>{selectedId ? <><Avatar contact={activeContact} /><div><h2 className="font-display text-lg font-semibold">{activeName}</h2><p className="text-xs text-muted-foreground">@{activeContact?.username ?? selectedUsername ?? "user"}</p></div></> : <div><h2 className="font-display text-lg font-semibold">Choose a conversation</h2><p className="text-xs text-muted-foreground">Select someone to send a message</p></div>}</div>
          {!selectedId ? <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground"><MessageCircle className="h-8 w-8 text-primary/50" /><p>Your messages will appear here.</p></div> : <><div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-5 py-5">{isLoading ? <p className="text-sm text-muted-foreground">Loading messages…</p> : messages.length === 0 ? <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">No messages yet.<br />Start the conversation below.</div> : messages.map((message) => { const mine = message.sender_id === userId; return <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>{!mine && <Avatar contact={activeContact} size="h-7 w-7" />}<div className={`max-w-[82%] ${mine ? "items-end" : "items-start"}`}><div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-background"}`}>{message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}{message.attachment_path && <a href={`/api/messages/file?pathname=${encodeURIComponent(message.attachment_path)}`} className="mt-2 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-xs font-medium hover:bg-black/20" target="_blank" rel="noreferrer"><Paperclip className="size-3.5" />{message.attachment_name ?? "Attachment"}</a>}</div><div className={`mt-1 flex items-center gap-1 text-[10px] text-muted-foreground ${mine ? "justify-end" : ""}`}><Clock3 className="h-3 w-3" />{formatTime(message.created_at)}{mine && message.read_at && <><span>·</span><Check className="h-3 w-3" />Read</>}{mine && <button type="button" onClick={() => void deleteMessage(message.id)} className="ml-2 inline-flex items-center gap-1 hover:text-destructive" aria-label="Delete message"><Trash2 className="size-3" />Delete</button>}</div></div></div>; })}</div><form className="border-t border-border bg-background px-5 py-4" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}><div className="flex items-center gap-2"><label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Attach a file"><Paperclip className="size-4" /><input type="file" className="sr-only" accept="image/*,.pdf,.txt,.md,.zip" onChange={(event) => { void uploadAttachment(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={uploading} /></label><Input value={body} onChange={(event) => setBody(event.target.value)} placeholder={`Write a message to ${activeName}…`} maxLength={4000} aria-label="Message" /><Button type="submit" disabled={(!body.trim() && !attachment) || uploading}><Send className="h-4 w-4" /><span className="sr-only">Send message</span></Button></div>{attachment && <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs"><Paperclip className="size-3.5 text-primary" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="size-3.5" /></button></div>}{sendError && <p className="mt-2 text-xs text-destructive">{sendError}</p>}<p className="mt-2 text-[11px] text-muted-foreground">Press Enter to send · 4,000 characters max</p></form></>}
        </section>
      </div>
    </AppShell>
  );
}
