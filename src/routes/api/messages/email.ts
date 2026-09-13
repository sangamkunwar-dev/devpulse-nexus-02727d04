import { createFileRoute } from "@tanstack/react-router";
import { Resend } from "resend";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/messages/email")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { data: auth } = await supabaseAdmin.auth.getUser(token);
    if (!auth.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const payload = await request.json() as { recipientId?: string; senderName?: string; preview?: string; messageId?: string };
    if (!payload.recipientId || !payload.messageId) return Response.json({ error: "Invalid notification" }, { status: 400 });
    const { data: recipientAuth } = await supabaseAdmin.auth.admin.getUserById(payload.recipientId);
    if (!recipientAuth.user?.email || !process.env.RESEND_API_KEY) return Response.json({ ok: true });
    const { data: recipient } = await supabaseAdmin.from("profiles").select("display_name,username").eq("user_id", payload.recipientId).maybeSingle();
    const from = process.env.RESEND_EMAIL_DOMAIN ? `DevPulse <notifications@${process.env.RESEND_EMAIL_DOMAIN}>` : "DevPulse <onboarding@resend.dev>";
    const resend = new Resend(process.env.RESEND_API_KEY);
    const safePreview = (payload.preview ?? "").slice(0, 220).replace(/[<>&]/g, "");
    const { error } = await resend.emails.send({ from, to: [recipientAuth.user.email], subject: `${payload.senderName ?? "Someone"} sent you a message on DevPulse`, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#17202a"><p style="color:#0f766e;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px">DEVPULSE</p><h1 style="font-size:24px;margin:16px 0 8px">You have a new message</h1><p style="color:#52606d">${payload.senderName ?? "Someone"} sent you a message.</p><div style="background:#f4f7f8;border-radius:14px;padding:18px;margin:24px 0;color:#17202a">${safePreview || "You received an attachment."}</div><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://devpulse.app"}/messages?userId=${auth.user.id}" style="display:inline-block;background:#0f766e;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open message</a><p style="color:#7b8794;font-size:12px;margin-top:32px">You are receiving this because someone contacted you on DevPulse.</p></div>` }, { idempotencyKey: `message-notification/${payload.messageId}` });
    if (error) return Response.json({ error: "Email notification failed" }, { status: 502 });
    return Response.json({ ok: true });
  } } }
});
