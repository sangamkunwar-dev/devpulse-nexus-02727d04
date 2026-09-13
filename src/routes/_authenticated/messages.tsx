import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
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
type Message = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };

function MessagesPage() {
  const { userId } = useSession();
  const { userId: selectedId, username: selectedUsername } = Route.useSearch();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["message-contacts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_follows")
        .select("following_id, follower_id")
        .or(`follower_id.eq.${userId},following_id.eq.${userId}`);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((row) => row.follower_id === userId ? row.following_id : row.follower_id))];
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
      const { data, error } = await supabase.from("direct_messages").select("id, sender_id, recipient_id, body, created_at")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${userId})`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!userId || !selectedId) return;
    const channel = supabase.channel(`messages-${userId}-${selectedId}`).on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => {
      queryClient.invalidateQueries({ queryKey: ["direct-messages", userId, selectedId] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, selectedId, userId]);

  const sendMessage = async () => {
    const text = body.trim();
    if (!text || !userId || !selectedId) return;
    const { error } = await supabase.from("direct_messages").insert({ sender_id: userId, recipient_id: selectedId, body: text });
    if (error) return;
    setBody("");
    await queryClient.invalidateQueries({ queryKey: ["direct-messages", userId, selectedId] });
  };

  return (
    <AppShell title="Messages">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row">
        <section className="bento-card w-full p-4 lg:w-72">
          <div className="mb-3 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /><h2 className="font-display font-semibold">Messages</h2></div>
          {contacts.length === 0 ? <p className="text-sm text-muted-foreground">Search for someone on Dashboard and follow them to start a conversation.</p> : <div className="space-y-1">{contacts.map((contact) => <Link key={contact.user_id} to="/messages" search={{ userId: contact.user_id, username: contact.username ?? "" }} className={`block rounded-lg px-3 py-2 text-sm hover:bg-muted ${contact.user_id === selectedId ? "bg-muted" : ""}`}><span className="block font-medium">{contact.display_name ?? contact.username}</span><span className="text-xs text-muted-foreground">@{contact.username}</span></Link>)}</div>}
        </section>
        <section className="bento-card flex min-h-[520px] min-w-0 flex-1 flex-col p-4">
          <div className="border-b border-border pb-3"><Link to="/dashboard" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" /> Back to Dashboard</Link><h2 className="font-display text-lg font-semibold">{activeName}</h2></div>
          {!selectedId ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a person to message.</div> : <><div className="flex-1 space-y-3 overflow-y-auto py-4">{isLoading ? <p className="text-sm text-muted-foreground">Loading messages…</p> : messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p> : messages.map((message) => <div key={message.id} className={`flex ${message.sender_id === userId ? "justify-end" : "justify-start"}`}><p className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.sender_id === userId ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{message.body}</p></div>)}</div><form className="flex gap-2 border-t border-border pt-3" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}><Input value={body} onChange={(event) => setBody(event.target.value)} placeholder={`Message ${activeName}…`} maxLength={4000} aria-label="Message" /><Button type="submit" disabled={!body.trim()}><Send className="h-4 w-4" /><span className="sr-only">Send message</span></Button></form></>}
        </section>
      </div>
    </AppShell>
  );
}
