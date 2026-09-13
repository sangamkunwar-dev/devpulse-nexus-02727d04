import { Resend } from "resend";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character);
}

export async function sendNotificationEmail(input: { recipientId: string; kind: string; title: string; body?: string; href?: string | null; notificationId?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, reason: "RESEND_API_KEY is not configured" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: userData }, { data: profile }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(input.recipientId),
    supabaseAdmin.from("profiles").select("display_name,username").eq("user_id", input.recipientId).maybeSingle(),
  ]);
  const recipient = userData.user?.email;
  if (!recipient) return { ok: false, skipped: true, reason: "Recipient has no email" };

  const resend = new Resend(apiKey);
  const senderDomain = process.env.RESEND_EMAIL_DOMAIN?.trim();
  const from = senderDomain ? `DevPulse <notifications@${senderDomain}>` : "DevPulse <onboarding@resend.dev>";
  const appUrl = process.env.APP_URL ?? "https://devpulse-nexus.lovable.app";
  const actionUrl = input.href ? `${appUrl}${input.href}` : `${appUrl}/dashboard`;
  const name = profile?.display_name || profile?.username || "there";
  const result = await resend.emails.send({
    from,
    to: [recipient],
    subject: `DevPulse · ${input.title}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;background:#f6f8f7;padding:32px;color:#17211d"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dfe7e2;border-radius:18px;overflow:hidden"><div style="background:#10201a;padding:24px 28px;color:#fff"><strong style="font-size:18px">DevPulse</strong><div style="margin-top:8px;color:#b8d8c9;font-size:13px">A new update for your learning workspace</div></div><div style="padding:28px"><p style="color:#5c6b63">Hi ${escapeHtml(name)},</p><h1 style="font-size:24px;margin:8px 0 12px">${escapeHtml(input.title)}</h1><p style="line-height:1.7;color:#53625a">${escapeHtml(input.body || "You have a new update in DevPulse.")}</p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:18px;background:#42d99a;color:#092016;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Open DevPulse</a><p style="margin-top:28px;color:#8a9790;font-size:12px">You are receiving this because activity happened in your DevPulse account.</p></div></div></div>`,
  }, { idempotencyKey: `notification/${input.notificationId ?? `${input.recipientId}-${input.kind}-${Date.now()}`}` });
  if (result.error) return { ok: false, error: result.error.message };
  return { ok: true, id: result.data?.id };
}
